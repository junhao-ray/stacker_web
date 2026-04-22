import type { PlcCommand } from "@/lib/types";

export type PlcSecurityMode = "None" | "Sign" | "SignAndEncrypt";
export type PlcSecurityPolicy =
  | "None"
  | "Basic128Rsa15"
  | "Basic256"
  | "Basic256Sha256";

export interface PlcNodeStepFormValue {
  index: string;
  productCode: string;
  quantity: string;
  side: string;
  column: string;
  level: string;
  slotId: string;
}

export interface PlcGatewayConfigFormValue {
  endpointUrl: string;
  securityMode: PlcSecurityMode;
  securityPolicy: PlcSecurityPolicy;
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
  nodes: {
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
      steps: PlcNodeStepFormValue[];
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
    reconnectIntervalMs: 2000,
    pulseDurationMs: 120,
    pollIntervalMs: 1000,
    sideMapping: {
      left: 1,
      right: 2,
    },
    commandCodes: {
      dispatchTask: 10,
      start: 20,
      pause: 30,
      resume: 40,
      reset: 50,
    },
    nodes: {
      command: {
        code: "",
        seq: "",
        trigger: "",
      },
      ack: {
        lastAckSeq: "",
        lastAckCode: "",
        lastAckResult: "",
      },
      machine: {
        state: "",
        currentTaskNo: "",
        alarm: "",
        errorCode: "",
        errorMessage: "",
      },
      task: {
        header: {
          taskNo: "",
          orderNo: "",
          stepCount: "",
        },
        steps: [
          {
            index: "",
            productCode: "",
            quantity: "",
            side: "",
            column: "",
            level: "",
            slotId: "",
          },
        ],
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
      ack: { ...value.nodes.ack },
      machine: { ...value.nodes.machine },
      task: {
        header: { ...value.nodes.task.header },
        steps: value.nodes.task.steps.map((step) => ({ ...step })),
      },
    },
  };
}
