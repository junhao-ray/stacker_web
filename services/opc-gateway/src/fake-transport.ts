import type { DispatchTaskPayload, PlcCommand, PlcLastCommand } from "@/lib/types";

import type {
  GatewayCommandContext,
  PlcRuntimeSnapshot,
  PlcTransport,
  TransportStatus,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

export class FakePlcTransport implements PlcTransport {
  private connected = true;
  private configured = true;
  private snapshot: PlcRuntimeSnapshot = {
    machineState: "idle",
    currentTaskNo: null,
    alarm: false,
    errorCode: null,
    errorMessage: null,
    ackSeq: 0,
    ackCode: 0,
    ackResult: "ok",
  };

  async start() {
    return;
  }

  async stop() {
    return;
  }

  getStatus(): TransportStatus {
    return {
      configured: this.configured,
      connected: this.connected,
      snapshot: { ...this.snapshot },
    };
  }

  async writeTaskPayload(task: DispatchTaskPayload) {
    this.snapshot.currentTaskNo = task.taskNo;
  }

  async sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand> {
    this.snapshot.ackSeq = context.seq;
    this.snapshot.ackCode = context.commandCode;
    this.snapshot.ackResult = "ok";

    this.transitionState(context.command, context.taskNo);

    return {
      command: context.command,
      taskNo: context.taskNo,
      result: "ok",
      requestId: context.requestId,
      acknowledgedAt: nowIso(),
    };
  }

  private transitionState(command: PlcCommand, taskNo: string | null) {
    if (command === "dispatchTask") {
      this.snapshot.currentTaskNo = taskNo;
      this.snapshot.machineState = "idle";
      return;
    }

    if (command === "start") {
      this.snapshot.machineState = "running";
      return;
    }

    if (command === "pause") {
      this.snapshot.machineState = "paused";
      return;
    }

    if (command === "resume") {
      this.snapshot.machineState = "running";
      return;
    }

    if (command === "reset") {
      this.snapshot.machineState = "idle";
      this.snapshot.alarm = false;
      this.snapshot.errorCode = null;
      this.snapshot.errorMessage = null;
    }
  }
}
