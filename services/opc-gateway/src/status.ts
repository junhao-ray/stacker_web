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
