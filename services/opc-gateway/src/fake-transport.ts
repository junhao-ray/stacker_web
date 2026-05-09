import type { PlcCommand, PlcLastCommand } from "@/lib/types";

import type {
  GatewayCommandContext,
  PlcRuntimeSnapshot,
  PlcTransport,
  TransportStatus,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function createSnapshot(): PlcRuntimeSnapshot {
  return {
    machineState: "idle",
    currentTaskNo: null,
    currentSeq: null,
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
  };
}

export class FakePlcTransport implements PlcTransport {
  private connected = true;
  private configured = true;
  private snapshot: PlcRuntimeSnapshot = createSnapshot();

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

  async sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand> {
    this.snapshot.ackSeq = context.seq;
    this.snapshot.ackCode = context.commandCode;
    this.snapshot.ackResult = "ok";

    const acknowledgedAt = nowIso();
    this.transitionState(context.command, context);

    return {
      command: context.command,
      taskNo: context.payload?.taskNo ?? this.snapshot.currentTaskNo,
      stepId: context.payload?.stepId ?? this.snapshot.currentStepId,
      result: "ok",
      requestId: context.requestId,
      acknowledgedAt,
      completedAt: nowIso(),
    };
  }

  private transitionState(command: PlcCommand, context: GatewayCommandContext) {
    if (command === "pickToBin" && context.payload) {
      this.snapshot.currentTaskNo = context.payload.taskNo;
      this.snapshot.currentSeq = context.seq;
      this.snapshot.currentStepId = context.payload.stepId;
      this.snapshot.actualX = context.payload.targetX;
      this.snapshot.actualY = context.payload.targetY;
      this.snapshot.machineState = "idle";
      this.snapshot.stepBusy = false;
      this.snapshot.stepDone = true;
      return;
    }

    if (command === "releaseBin" || command === "home") {
      this.snapshot.currentSeq = context.seq;
      this.snapshot.machineState = "idle";
      this.snapshot.stepBusy = false;
      this.snapshot.stepDone = true;
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

    if (command === "resetAlarm") {
      this.snapshot = createSnapshot();
    }
  }
}
