import { describe, expect, it } from "vitest";

import type { DispatchTaskPayload } from "@/lib/types";
import { PlcGateway } from "../services/opc-gateway/src/gateway";
import type { GatewayConfig, PlcTransport, TransportStatus } from "../services/opc-gateway/src/types";

function createConfig(): GatewayConfig {
  return {
    endpointUrl: "opc.tcp://127.0.0.1:4840",
    securityMode: "None",
    securityPolicy: "None",
    requestedSessionTimeoutMs: 20000,
    ackTimeoutMs: 3000,
    reconnectIntervalMs: 2000,
    pulseDurationMs: 120,
    pollIntervalMs: 1000,
    sideMapping: { left: 1, right: 2 },
    commandCodes: {
      dispatchTask: 10,
      start: 20,
      pause: 30,
      resume: 40,
      reset: 50,
    },
    nodes: {
      command: { code: "1", seq: "2", trigger: "3" },
      ack: { lastAckSeq: "4", lastAckCode: "5", lastAckResult: "6" },
      machine: {
        state: "7",
        currentTaskNo: "8",
        alarm: "9",
        errorCode: "10",
        errorMessage: "11",
      },
      task: {
        header: { taskNo: "12", orderNo: "13", stepCount: "14" },
        steps: [
          { index: "15", productCode: "16", quantity: "17", side: "18", column: "19", level: "20", slotId: "21" },
        ],
      },
    },
  };
}

function createTask(): DispatchTaskPayload {
  return {
    taskNo: "TASK-1",
    orderNo: "ORDER-1",
    stepCount: 1,
    steps: [
      {
        index: 1,
        productCode: "SKU-1",
        quantity: 2,
        side: "left",
        column: 1,
        level: 1,
        slotId: "left-01-01",
      },
    ],
  };
}

class StubTransport implements PlcTransport {
  status: TransportStatus = {
    configured: true,
    connected: true,
    snapshot: {
      machineState: "idle",
      currentTaskNo: null,
      alarm: false,
      errorCode: null,
      errorMessage: null,
      ackSeq: 0,
      ackCode: 0,
      ackResult: "ok",
    },
  };

  writes: string[] = [];

  async start() {
    return;
  }

  async stop() {
    return;
  }

  getStatus() {
    return this.status;
  }

  async writeTaskPayload(task: DispatchTaskPayload) {
    this.writes.push(`task:${task.taskNo}`);
    this.status.snapshot.currentTaskNo = task.taskNo;
  }

  async sendCommand(context: { command: string; requestId: string; seq: number; commandCode: number; taskNo: string | null; }) {
    this.writes.push(`command:${context.command}:${context.seq}:${context.commandCode}`);
    if (context.command === "start") {
      this.status.snapshot.machineState = "running";
    }
    return {
      command: context.command as "dispatchTask" | "start" | "pause" | "resume" | "reset",
      taskNo: context.taskNo,
      result: "ok" as const,
      requestId: context.requestId,
      acknowledgedAt: new Date().toISOString(),
    };
  }
}

describe("PlcGateway", () => {
  it("writes task payload before dispatch command", async () => {
    const transport = new StubTransport();
    const gateway = new PlcGateway(createConfig(), transport);

    await gateway.execute({
      command: "dispatchTask",
      task: createTask(),
    });

    expect(transport.writes).toEqual([
      "task:TASK-1",
      expect.stringMatching(/^command:dispatchTask:/),
    ]);
  });

  it("rejects pause when machine is not running", async () => {
    const transport = new StubTransport();
    const gateway = new PlcGateway(createConfig(), transport);

    await expect(gateway.execute({ command: "pause" })).rejects.toMatchObject({
      status: 409,
      code: "invalid_machine_state",
    });
  });
});
