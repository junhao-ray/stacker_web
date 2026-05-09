import type { PlcCommand, PlcLastCommand, PlcStatusSnapshot } from "@/lib/types";

import type { PlcRuntimeSnapshot, TransportStatus } from "./types";

function normalizeMachineState(snapshot: PlcRuntimeSnapshot) {
  if (snapshot.alarm) return "alarm";
  return snapshot.machineState;
}

export function buildStatusSnapshot(
  status: TransportStatus,
  commandInFlight: boolean,
  lastCommand: PlcLastCommand | null,
): PlcStatusSnapshot {
  return {
    configured: status.configured,
    connected: status.connected,
    machineState: normalizeMachineState(status.snapshot),
    currentTaskNo: status.snapshot.currentTaskNo,
    currentSeq: status.snapshot.currentSeq,
    currentStepId: status.snapshot.currentStepId,
    stepBusy: status.snapshot.stepBusy,
    stepDone: status.snapshot.stepDone,
    actualX: status.snapshot.actualX,
    actualY: status.snapshot.actualY,
    alarm: status.snapshot.alarm,
    errorCode: status.snapshot.errorCode,
    errorMessage: status.snapshot.errorMessage,
    commandInFlight,
    lastCommand,
    updatedAt: new Date().toISOString(),
  };
}

export function createLastCommand(
  command: PlcCommand,
  requestId: string,
  taskNo: string | null,
  result: PlcLastCommand["result"],
  options?: Partial<Omit<PlcLastCommand, "command" | "requestId" | "taskNo" | "result">>,
): PlcLastCommand {
  return {
    command,
    taskNo,
    result,
    requestId,
    ...options,
  };
}
