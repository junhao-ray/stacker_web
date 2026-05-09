import type { PlcCommand } from "@/lib/types";

export type PlcSecurityMode = "None" | "Sign" | "SignAndEncrypt";
export type PlcSecurityPolicy =
  | "None"
  | "Basic128Rsa15"
  | "Basic256"
  | "Basic256Sha256";

export interface PlcGatewayConfigFormValue {
  endpointUrl: string;
  securityMode: PlcSecurityMode;
  securityPolicy: PlcSecurityPolicy;
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
  nodes: {
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
  };
}

export const PLC_SECURITY_MODES: PlcSecurityMode[] = ["None", "Sign", "SignAndEncrypt"];
export const PLC_SECURITY_POLICIES: PlcSecurityPolicy[] = [
  "None",
  "Basic128Rsa15",
  "Basic256",
  "Basic256Sha256",
];

export function createDefaultPlcGatewayConfigFormValue(): PlcGatewayConfigFormValue {
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
    sideMapping: {
      left: 1,
      right: 2,
    },
    commandCodes: {
      pickToBin: 100,
      releaseBin: 110,
      pause: 120,
      resume: 130,
      home: 140,
      resetAlarm: 150,
    },
    nodes: {
      command: {
        seq: "",
        code: "",
        trigger: "",
      },
      target: {
        x: "",
        y: "",
        side: "",
        qty: "",
      },
      trace: {
        taskNo: "",
        orderNo: "",
        stepId: "",
        productCode: "",
        slotId: "",
      },
      ack: {
        seq: "",
        code: "",
        result: "",
      },
      machine: {
        state: "",
        stepBusy: "",
        stepDone: "",
        currentSeq: "",
        currentStepId: "",
        actualX: "",
        actualY: "",
        alarm: "",
        errorCode: "",
        errorMessage: "",
      },
    },
  };
}

export function clonePlcGatewayConfigFormValue(value: PlcGatewayConfigFormValue): PlcGatewayConfigFormValue {
  return {
    ...value,
    sideMapping: { ...value.sideMapping },
    commandCodes: { ...value.commandCodes },
    nodes: {
      command: { ...value.nodes.command },
      target: { ...value.nodes.target },
      trace: { ...value.nodes.trace },
      ack: { ...value.nodes.ack },
      machine: { ...value.nodes.machine },
    },
  };
}
