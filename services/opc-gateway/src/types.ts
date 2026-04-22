import type {
  DispatchTaskPayload,
  PlcCommand,
  PlcLastCommand,
  PlcMachineState,
  PlcStatusSnapshot,
} from "@/lib/types";

export interface GatewayNodeMap {
  command: {
    code: string;
    seq: string;
    trigger: string;
  };
  ack: {
    lastAckSeq: string;
    lastAckCode: string;
    lastAckResult: string;
  };
  machine: {
    state: string;
    currentTaskNo: string;
    alarm: string;
    errorCode: string;
    errorMessage: string;
  };
  task: {
    header: {
      taskNo: string;
      orderNo: string;
      stepCount: string;
    };
    steps: Array<{
      index: string;
      productCode: string;
      quantity: string;
      side: string;
      column: string;
      level: string;
      slotId: string;
    }>;
  };
}

export interface GatewayConfig {
  endpointUrl: string;
  securityMode: string;
  securityPolicy: string;
  requestedSessionTimeoutMs: number;
  ackTimeoutMs: number;
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
  alarm: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  ackSeq: number | null;
  ackCode: number | null;
  ackResult: string | null;
}

export interface GatewayCommandRequest {
  command: PlcCommand;
  task?: DispatchTaskPayload;
}

export interface GatewayCommandContext {
  command: PlcCommand;
  requestId: string;
  seq: number;
  commandCode: number;
  taskNo: string | null;
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
  writeTaskPayload(task: DispatchTaskPayload): Promise<void>;
  sendCommand(context: GatewayCommandContext): Promise<PlcLastCommand>;
}
