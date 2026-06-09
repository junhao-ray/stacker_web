import type {
  PlcCommand,
  PlcCommandResult,
  PlcLastCommand,
  PlcMachineState,
  PlcPickToBinPayload,
  PlcStatusSnapshot,
} from "@/lib/types";

export interface GatewayNodeMap {
  command: {
    seq: string;
    code: string;
    trigger: string;
  };
  target: {
    x: string;
    y: string;
    side: string;
    qty: string;
  };
  trace: {
    taskNo: string;
    orderNo: string;
    stepId: string;
    productCode: string;
    slotId: string;
  };
  ack: {
    seq: string;
    code: string;
    result: string;
  };
  machine: {
    state: string;
    stepBusy: string;
    stepDone: string;
    currentSeq: string;
    currentStepId: string;
    actualX: string;
    actualY: string;
    alarm: string;
    errorCode: string;
    errorMessage: string;
  };
  diagnostics: {
    heartbeat: string;
    motionPhase: string;
    vacuumOn: string;
    vacuumOk: string;
    cylinderExtended: string;
    cylinderRetracted: string;
    axisXInPosition: string;
    axisYInPosition: string;
    safetyOk: string;
    doorClosed: string;
    estopOk: string;
  };
}

export interface GatewayConfig {
  endpointUrl: string;
  securityMode: string;
  securityPolicy: string;
  requestedSessionTimeoutMs: number;
  ackTimeoutMs: number;
  stepDoneTimeoutMs: number;
  reconnectIntervalMs: number;
  pulseDurationMs: number;
  pollIntervalMs: number;
  sideMapping: {
    left: number;
    right: number;
  };
  commandCodes: Record<PlcCommand, number>;
  nodes: GatewayNodeMap;
}

export interface PlcRuntimeSnapshot {
  machineState: PlcMachineState;
  currentTaskNo: string | null;
  currentSeq: number | null;
  currentStepId: string | null;
  stepBusy: boolean;
  stepDone: boolean;
  actualX: number | null;
  actualY: number | null;
  alarm: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  ackSeq: number | null;
  ackCode: number | null;
  ackResult: PlcCommandResult | string | null;
}

export interface GatewayCommandRequest {
  command: PlcCommand;
  payload?: PlcPickToBinPayload;
}

export interface GatewayCommandContext {
  command: PlcCommand;
  requestId: string;
  seq: number;
  commandCode: number;
  payload?: PlcPickToBinPayload;
}

export interface GatewayCommandResponse {
  status: number;
  body: PlcStatusSnapshot;
}

export interface TransportStatus {
  configured: boolean;
  connected: boolean;
  snapshot: PlcRuntimeSnapshot;
}

export interface PlcTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): TransportStatus;
  sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand>;
}
