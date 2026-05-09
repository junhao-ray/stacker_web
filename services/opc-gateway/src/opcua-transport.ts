import {
  AttributeIds,
  type ClientSession,
  ClientSubscription,
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  TimestampsToReturn,
  DataType,
  type ClientMonitoredItem,
  type DataValue,
  type NodeIdLike,
  StatusCodes,
} from "node-opcua";

import type { PlcCommandResult, PlcLastCommand, PlcMachineState } from "@/lib/types";

import { GatewayHttpError } from "./errors";
import type {
  GatewayCommandContext,
  GatewayConfig,
  PlcRuntimeSnapshot,
  PlcTransport,
  TransportStatus,
} from "./types";

function toNodeId(nodeId: string): NodeIdLike {
  return nodeId;
}

function normalizeMachineState(raw: unknown): PlcMachineState {
  if (typeof raw === "number") {
    if (raw === 1) return "running";
    if (raw === 2) return "paused";
    if (raw === 3) return "alarm";
    if (raw === 0) return "idle";
    return "unknown";
  }

  if (typeof raw === "string") {
    const value = raw.toLowerCase();
    if (value === "idle" || value === "running" || value === "paused" || value === "alarm") {
      return value;
    }
  }

  return "unknown";
}

function normalizeAckResult(raw: unknown): PlcCommandResult | string {
  const value = String(raw ?? "").toLowerCase();
  if (
    value === "ok" ||
    value === "busy" ||
    value === "alarm" ||
    value === "invalid_target" ||
    value === "rejected" ||
    value === "timeout" ||
    value === "transport_error"
  ) {
    return value;
  }
  return value || "rejected";
}

function extractScalar(dataValue: DataValue) {
  return dataValue.value.value;
}

async function writeNode(session: ClientSession, nodeId: string, dataType: DataType, value: string | number | boolean) {
  const statusCode = await session.write({
    nodeId: toNodeId(nodeId),
    attributeId: AttributeIds.Value,
    value: {
      value: {
        dataType,
        value,
      },
    },
  });

  if (statusCode !== StatusCodes.Good) {
    throw new GatewayHttpError(`Failed to write OPC node: ${nodeId}`, 502, "opc_write_failed", "transport_error");
  }
}

function createSnapshot(): PlcRuntimeSnapshot {
  return {
    machineState: "unknown",
    currentTaskNo: null,
    currentSeq: null,
    currentStepId: null,
    stepBusy: false,
    stepDone: false,
    actualX: null,
    actualY: null,
    alarm: false,
    errorCode: null,
    errorMessage: null,
    ackSeq: null,
    ackCode: null,
    ackResult: null,
  };
}

function commandWaitsForDone(command: GatewayCommandContext["command"]) {
  return command === "pickToBin" || command === "releaseBin" || command === "home";
}

export class OpcUaPlcTransport implements PlcTransport {
  private client: OPCUAClient | null = null;
  private session: ClientSession | null = null;
  private subscription: ClientSubscription | null = null;
  private monitors: ClientMonitoredItem[] = [];
  private connected = false;
  private snapshot = createSnapshot();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: GatewayConfig,
    private readonly configured: boolean,
  ) {}

  async start() {
    if (!this.configured) {
      return;
    }

    await this.connect();
  }

  async stop() {
    const subscription = this.subscription;
    const session = this.session;
    const client = this.client;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (subscription) {
      await subscription.terminate();
    }
    if (session) {
      await session.close();
    }
    if (client) {
      await client.disconnect();
    }
    this.monitors = [];
    this.subscription = null;
    this.session = null;
    this.client = null;
    this.connected = false;
  }

  getStatus(): TransportStatus {
    return {
      configured: this.configured,
      connected: this.connected,
      snapshot: { ...this.snapshot },
    };
  }

  async sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand> {
    const session = this.requireSession();

    if (context.payload) {
      this.snapshot.currentTaskNo = context.payload.taskNo;
      await Promise.all([
        writeNode(session, this.config.nodes.target.x, DataType.Double, context.payload.targetX),
        writeNode(session, this.config.nodes.target.y, DataType.Double, context.payload.targetY),
        writeNode(session, this.config.nodes.target.side, DataType.UInt32, context.payload.targetSide),
        writeNode(session, this.config.nodes.target.qty, DataType.UInt32, context.payload.targetQty),
        writeNode(session, this.config.nodes.trace.taskNo, DataType.String, context.payload.taskNo),
        writeNode(session, this.config.nodes.trace.orderNo, DataType.String, context.payload.orderNo),
        writeNode(session, this.config.nodes.trace.stepId, DataType.String, context.payload.stepId),
        writeNode(session, this.config.nodes.trace.productCode, DataType.String, context.payload.productCode),
        writeNode(session, this.config.nodes.trace.slotId, DataType.String, context.payload.slotId),
      ]);
    }

    await writeNode(session, this.config.nodes.command.code, DataType.UInt32, context.commandCode);
    await writeNode(session, this.config.nodes.command.seq, DataType.UInt32, context.seq);
    await writeNode(session, this.config.nodes.command.trigger, DataType.Boolean, true);
    await new Promise((resolve) => setTimeout(resolve, this.config.pulseDurationMs));
    await writeNode(session, this.config.nodes.command.trigger, DataType.Boolean, false);

    const acknowledgedAt = await this.waitForAck(context);
    const completedAt = commandWaitsForDone(context.command)
      ? await this.waitForStepDone(context)
      : undefined;

    return {
      command: context.command,
      taskNo: context.payload?.taskNo ?? this.snapshot.currentTaskNo,
      stepId: context.payload?.stepId ?? this.snapshot.currentStepId,
      result: "ok",
      requestId: context.requestId,
      acknowledgedAt,
      completedAt,
    };
  }

  private async connect() {
    try {
      const client = OPCUAClient.create({
        applicationName: "stacker-web-opc-gateway",
        securityMode: MessageSecurityMode[this.config.securityMode as keyof typeof MessageSecurityMode] ?? MessageSecurityMode.None,
        securityPolicy: SecurityPolicy[this.config.securityPolicy as keyof typeof SecurityPolicy] ?? SecurityPolicy.None,
        requestedSessionTimeout: this.config.requestedSessionTimeoutMs,
        endpointMustExist: false,
      });

      client.on("backoff", () => {
        this.connected = false;
      });
      client.on("connection_lost", () => {
        this.connected = false;
      });

      await client.connect(this.config.endpointUrl);
      const session = await client.createSession();
      const subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: this.config.pollIntervalMs,
        requestedLifetimeCount: 10,
        requestedMaxKeepAliveCount: 3,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10,
      });

      this.client = client;
      this.session = session;
      this.subscription = subscription;
      this.connected = true;

      await this.installMonitors();
      await this.refreshSnapshot();
    } catch (error) {
      this.connected = false;
      this.scheduleReconnect();
      throw error;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, this.config.reconnectIntervalMs);
  }

  private async installMonitors() {
    const subscription = this.subscription;
    if (!subscription) return;

    const nodes = [
      this.config.nodes.ack.seq,
      this.config.nodes.ack.code,
      this.config.nodes.ack.result,
      this.config.nodes.machine.state,
      this.config.nodes.machine.stepBusy,
      this.config.nodes.machine.stepDone,
      this.config.nodes.machine.currentSeq,
      this.config.nodes.machine.currentStepId,
      this.config.nodes.machine.actualX,
      this.config.nodes.machine.actualY,
      this.config.nodes.machine.alarm,
      this.config.nodes.machine.errorCode,
      this.config.nodes.machine.errorMessage,
    ];

    this.monitors = await Promise.all(
      nodes.map(async (nodeId) => {
        const monitor = await subscription.monitor(
          { nodeId: toNodeId(nodeId), attributeId: AttributeIds.Value },
          { samplingInterval: this.config.pollIntervalMs, discardOldest: true, queueSize: 10 },
          TimestampsToReturn.Both,
        );

        monitor.on("changed", () => {
          void this.refreshSnapshot();
        });

        return monitor;
      }),
    );
  }

  private async refreshSnapshot() {
    const session = this.requireSession();
    const reads = await Promise.all([
      session.read({ nodeId: toNodeId(this.config.nodes.ack.seq), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.ack.code), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.ack.result), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.state), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.stepBusy), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.stepDone), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.currentSeq), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.currentStepId), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.actualX), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.actualY), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.alarm), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.errorCode), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.errorMessage), attributeId: AttributeIds.Value }),
    ]);

    this.snapshot = {
      currentTaskNo: this.snapshot.currentTaskNo,
      ackSeq: Number(extractScalar(reads[0])) || 0,
      ackCode: Number(extractScalar(reads[1])) || 0,
      ackResult: normalizeAckResult(extractScalar(reads[2])),
      machineState: normalizeMachineState(extractScalar(reads[3])),
      stepBusy: Boolean(extractScalar(reads[4])),
      stepDone: Boolean(extractScalar(reads[5])),
      currentSeq: Number(extractScalar(reads[6])) || 0,
      currentStepId: String(extractScalar(reads[7]) ?? "") || null,
      actualX: Number(extractScalar(reads[8])),
      actualY: Number(extractScalar(reads[9])),
      alarm: Boolean(extractScalar(reads[10])),
      errorCode: String(extractScalar(reads[11]) ?? "") || null,
      errorMessage: String(extractScalar(reads[12]) ?? "") || null,
    };
  }

  private async waitForAck(context: GatewayCommandContext): Promise<string> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.config.ackTimeoutMs) {
      await this.refreshSnapshot();

      if (this.snapshot.ackSeq === context.seq) {
        if (String(this.snapshot.ackResult).toLowerCase() === "ok") {
          return new Date().toISOString();
        }

        const result = normalizeAckResult(this.snapshot.ackResult);
        throw new GatewayHttpError(
          this.snapshot.errorMessage ?? `PLC rejected command with ${result}`,
          result === "busy" ? 409 : 502,
          result === "invalid_target" ? "invalid_target" : "plc_rejected",
          result === "ok" ? "rejected" : (result as PlcCommandResult),
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new GatewayHttpError("Timed out waiting for PLC ACK", 504, "ack_timeout", "timeout");
  }

  private async waitForStepDone(context: GatewayCommandContext): Promise<string> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.config.stepDoneTimeoutMs) {
      await this.refreshSnapshot();

      if (this.snapshot.alarm || this.snapshot.machineState === "alarm") {
        throw new GatewayHttpError(
          this.snapshot.errorMessage ?? "PLC entered alarm state",
          502,
          this.snapshot.errorCode ?? "plc_alarm",
          "alarm",
        );
      }

      if (this.snapshot.stepDone && this.snapshot.currentSeq === context.seq) {
        return new Date().toISOString();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new GatewayHttpError("Timed out waiting for PLC step completion", 504, "step_done_timeout", "timeout");
  }

  private requireSession() {
    if (!this.session || !this.connected) {
      throw new GatewayHttpError("OPC UA session is disconnected", 503, "opc_disconnected", "transport_error");
    }

    return this.session;
  }
}
