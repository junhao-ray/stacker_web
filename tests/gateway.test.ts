import { describe, expect, it } from "vitest";

import type { PlcPickToBinPayload } from "@/lib/types";
import { PlcGateway } from "../services/opc-gateway/src/gateway";
import type { GatewayConfig, GatewayCommandContext, PlcTransport, TransportStatus } from "../services/opc-gateway/src/types";

function createConfig(): GatewayConfig {
  return {
    endpointUrl: "opc.tcp://127.0.0.1:4840",
    securityMode: "None",
    securityPolicy: "None",
    requestedSessionTimeoutMs: 20000,
    ackTimeoutMs: 3000,
    stepDoneTimeoutMs: 30000,
    reconnectIntervalMs: 2000,
    pulseDurationMs: 120,
    pollIntervalMs: 1000,
    sideMapping: { left: 1, right: 2 },
    commandCodes: {
      pickToBin: 100,
      releaseBin: 110,
      pause: 120,
      resume: 130,
      home: 140,
      resetAlarm: 150,
    },
    nodes: {
      command: { seq: "1", code: "2", trigger: "3" },
      target: { x: "4", y: "5", side: "6", qty: "7" },
      trace: { taskNo: "8", orderNo: "9", stepId: "10", productCode: "11", slotId: "12" },
      ack: { seq: "13", code: "14", result: "15" },
      machine: {
        state: "16",
        stepBusy: "17",
        stepDone: "18",
        currentSeq: "19",
        currentStepId: "20",
        actualX: "21",
        actualY: "22",
        alarm: "23",
        errorCode: "24",
        errorMessage: "25",
      },
      diagnostics: {
        heartbeat: "26",
        motionPhase: "27",
        vacuumOn: "28",
        vacuumOk: "29",
        cylinderExtended: "30",
        cylinderRetracted: "31",
        axisXInPosition: "32",
        axisYInPosition: "33",
        safetyOk: "34",
        doorClosed: "35",
        estopOk: "36",
      },
    },
  };
}

function createPayload(): PlcPickToBinPayload {
  return {
    taskNo: "TASK-1",
    orderNo: "ORDER-1",
    stepId: "STEP-1",
    productCode: "SKU-1",
    slotId: "left-01-01",
    targetX: 133,
    targetY: 111,
    targetSide: 1,
    targetQty: 1,
  };
}

class StubTransport implements PlcTransport {
  status: TransportStatus = {
    configured: true,
    connected: true,
    snapshot: {
      machineState: "idle",
      currentTaskNo: null,
      currentSeq: 0,
      currentStepId: null,
      stepBusy: false,
      stepDone: false,
      actualX: 0,
      actualY: 0,
      alarm: false,
      errorCode: null,
      errorMessage: null,
      ackSeq: 0,
      ackCode: 0,
      ackResult: "ok",
    },
  };

  contexts: GatewayCommandContext[] = [];

  async start() {
    return;
  }

  async stop() {
    return;
  }

  getStatus() {
    return this.status;
  }

  async sendCommand(context: GatewayCommandContext) {
    this.contexts.push(context);
    this.status.snapshot.ackSeq = context.seq;
    this.status.snapshot.ackCode = context.commandCode;
    this.status.snapshot.ackResult = "ok";
    this.status.snapshot.currentSeq = context.seq;
    this.status.snapshot.stepDone = true;
    this.status.snapshot.currentTaskNo = context.payload?.taskNo ?? this.status.snapshot.currentTaskNo;
    this.status.snapshot.currentStepId = context.payload?.stepId ?? this.status.snapshot.currentStepId;
    return {
      command: context.command,
      taskNo: context.payload?.taskNo ?? null,
      stepId: context.payload?.stepId ?? null,
      result: "ok" as const,
      requestId: context.requestId,
      acknowledgedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}

describe("PlcGateway", () => {
  it("passes the single-package payload with the PickToBin command", async () => {
    const transport = new StubTransport();
    const gateway = new PlcGateway(createConfig(), transport);
    const payload = createPayload();

    await gateway.execute({
      command: "pickToBin",
      payload,
    });

    expect(transport.contexts).toHaveLength(1);
    expect(transport.contexts[0]).toMatchObject({
      command: "pickToBin",
      commandCode: 100,
      payload,
    });
  });

  it("rejects pause when machine is not running", async () => {
    const transport = new StubTransport();
    const gateway = new PlcGateway(createConfig(), transport);

    await expect(gateway.execute({ command: "pause" })).rejects.toMatchObject({
      status: 409,
      code: "invalid_machine_state",
    });
  });

  it("rejects pick commands while a step is busy", async () => {
    const transport = new StubTransport();
    transport.status.snapshot.stepBusy = true;
    const gateway = new PlcGateway(createConfig(), transport);

    await expect(gateway.execute({ command: "pickToBin", payload: createPayload() })).rejects.toMatchObject({
      status: 409,
      code: "plc_busy",
    });
  });
});
