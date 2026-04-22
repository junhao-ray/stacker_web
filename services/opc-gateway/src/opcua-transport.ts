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

import type { DispatchTaskPayload, PlcLastCommand, PlcMachineState } from "@/lib/types";

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
    throw new GatewayHttpError(`写入 OPC 节点失败: ${nodeId}`, 502, "opc_write_failed", "transport_error");
  }
}

function createSnapshot(): PlcRuntimeSnapshot {
  return {
    machineState: "unknown",
    currentTaskNo: null,
    alarm: false,
    errorCode: null,
    errorMessage: null,
    ackSeq: null,
    ackCode: null,
    ackResult: null,
  };
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

  async writeTaskPayload(task: DispatchTaskPayload) {
    const session = this.requireSession();
    const stepNodes = this.config.nodes.task.steps;

    if (task.steps.length > stepNodes.length) {
      throw new GatewayHttpError(
        `任务步骤数量 ${task.steps.length} 超出点位模板容量 ${stepNodes.length}`,
        409,
        "task_capacity_exceeded",
        "rejected",
      );
    }

    await Promise.all([
      writeNode(session, this.config.nodes.task.header.taskNo, DataType.String, task.taskNo),
      writeNode(session, this.config.nodes.task.header.orderNo, DataType.String, task.orderNo),
      writeNode(session, this.config.nodes.task.header.stepCount, DataType.UInt32, task.stepCount),
    ]);

    for (let index = 0; index < stepNodes.length; index += 1) {
      const mapping = stepNodes[index];
      const step = task.steps[index];

      await Promise.all([
        writeNode(session, mapping.index, DataType.UInt32, step?.index ?? 0),
        writeNode(session, mapping.productCode, DataType.String, step?.productCode ?? ""),
        writeNode(session, mapping.quantity, DataType.UInt32, step?.quantity ?? 0),
        writeNode(session, mapping.side, DataType.UInt32, step ? this.config.sideMapping[step.side] : 0),
        writeNode(session, mapping.column, DataType.UInt32, step?.column ?? 0),
        writeNode(session, mapping.level, DataType.UInt32, step?.level ?? 0),
        writeNode(session, mapping.slotId, DataType.String, step?.slotId ?? ""),
      ]);
    }
  }

  async sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand> {
    const session = this.requireSession();

    await writeNode(session, this.config.nodes.command.code, DataType.UInt32, context.commandCode);
    await writeNode(session, this.config.nodes.command.seq, DataType.UInt32, context.seq);
    await writeNode(session, this.config.nodes.command.trigger, DataType.Boolean, true);
    await new Promise((resolve) => setTimeout(resolve, this.config.pulseDurationMs));
    await writeNode(session, this.config.nodes.command.trigger, DataType.Boolean, false);

    return await this.waitForAck(context);
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
      this.config.nodes.ack.lastAckSeq,
      this.config.nodes.ack.lastAckCode,
      this.config.nodes.ack.lastAckResult,
      this.config.nodes.machine.state,
      this.config.nodes.machine.currentTaskNo,
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
      session.read({ nodeId: toNodeId(this.config.nodes.ack.lastAckSeq), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.ack.lastAckCode), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.ack.lastAckResult), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.state), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.currentTaskNo), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.alarm), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.errorCode), attributeId: AttributeIds.Value }),
      session.read({ nodeId: toNodeId(this.config.nodes.machine.errorMessage), attributeId: AttributeIds.Value }),
    ]);

    this.snapshot = {
      ackSeq: Number(extractScalar(reads[0])) || 0,
      ackCode: Number(extractScalar(reads[1])) || 0,
      ackResult: String(extractScalar(reads[2]) ?? ""),
      machineState: normalizeMachineState(extractScalar(reads[3])),
      currentTaskNo: String(extractScalar(reads[4]) ?? "") || null,
      alarm: Boolean(extractScalar(reads[5])),
      errorCode: String(extractScalar(reads[6]) ?? "") || null,
      errorMessage: String(extractScalar(reads[7]) ?? "") || null,
    };
  }

  private async waitForAck(context: GatewayCommandContext): Promise<PlcLastCommand> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.config.ackTimeoutMs) {
      await this.refreshSnapshot();

      if (this.snapshot.ackSeq === context.seq) {
        if (String(this.snapshot.ackResult).toLowerCase() === "ok") {
          return {
            command: context.command,
            taskNo: context.taskNo,
            result: "ok",
            requestId: context.requestId,
            acknowledgedAt: new Date().toISOString(),
          };
        }

        throw new GatewayHttpError(
          this.snapshot.errorMessage ?? "PLC 拒绝了命令",
          502,
          "plc_rejected",
          "rejected",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new GatewayHttpError("等待 PLC ACK 超时", 504, "ack_timeout", "timeout");
  }

  private requireSession() {
    if (!this.session || !this.connected) {
      throw new GatewayHttpError("OPC UA 会话未连接", 503, "opc_disconnected", "transport_error");
    }

    return this.session;
  }
}
