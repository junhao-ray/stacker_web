import {
  DataType,
  type Namespace,
  OPCUAServer,
  StatusCodes,
  type UAObject,
  Variant,
} from "node-opcua";

import {
  SIMULATOR_MOTION_PHASE,
  type SimulatorAction,
  type SimulatorState,
  StackerSimulatorRuntime,
} from "./simulator-core";

const PORT = Number(process.env.OPC_SIMULATOR_PORT ?? 4840);
const RESOURCE_PATH = process.env.OPC_SIMULATOR_RESOURCE_PATH ?? "/UA/StackerSimulator";
const ACTION_MS = Number(process.env.OPC_SIMULATOR_ACTION_MS ?? 900);
const HEARTBEAT_MS = Number(process.env.OPC_SIMULATOR_HEARTBEAT_MS ?? 1000);

const runtime = new StackerSimulatorRuntime();
let completionTimer: ReturnType<typeof setTimeout> | null = null;
let phaseTimers: ReturnType<typeof setTimeout>[] = [];
let currentAction: SimulatorAction = null;

function nodeId(name: string) {
  return `s=Stacker.${name}`;
}

function clearActionTimers() {
  if (completionTimer) {
    clearTimeout(completionTimer);
    completionTimer = null;
  }
  for (const timer of phaseTimers) {
    clearTimeout(timer);
  }
  phaseTimers = [];
}

function phasesForAction(action: SimulatorAction) {
  if (action === "pickToBin") {
    return [
      SIMULATOR_MOTION_PHASE.safetyCheck,
      SIMULATOR_MOTION_PHASE.moveToPick,
      SIMULATOR_MOTION_PHASE.waitInPosition,
      SIMULATOR_MOTION_PHASE.extend,
      SIMULATOR_MOTION_PHASE.vacuumOn,
      SIMULATOR_MOTION_PHASE.vacuumCheck,
      SIMULATOR_MOTION_PHASE.retract,
      SIMULATOR_MOTION_PHASE.moveToBin,
      SIMULATOR_MOTION_PHASE.release,
    ];
  }

  if (action === "releaseBin") {
    return [
      SIMULATOR_MOTION_PHASE.moveToBin,
      SIMULATOR_MOTION_PHASE.release,
    ];
  }

  if (action === "home") {
    return [
      SIMULATOR_MOTION_PHASE.safetyCheck,
      SIMULATOR_MOTION_PHASE.moveToPick,
      SIMULATOR_MOTION_PHASE.done,
    ];
  }

  return [];
}

function scheduleAction(action: SimulatorAction) {
  if (!action) return;
  clearActionTimers();
  currentAction = action;

  const phases = phasesForAction(action);
  phases.forEach((phase, index) => {
    const delay = Math.round((ACTION_MS / Math.max(phases.length, 1)) * index);
    phaseTimers.push(setTimeout(() => {
      runtime.setMotionPhase(phase);
    }, delay));
  });

  completionTimer = setTimeout(() => {
    runtime.completeCurrentAction();
    currentAction = null;
    completionTimer = null;
    console.log(`[opc-simulator] completed action=${action} seq=${runtime.state.Current_Seq}`);
  }, ACTION_MS);
}

function dataTypeForValue(value: SimulatorState[keyof SimulatorState]) {
  if (typeof value === "boolean") return DataType.Boolean;
  if (typeof value === "string") return DataType.String;
  if (Number.isInteger(value)) return DataType.UInt32;
  return DataType.Double;
}

function addVariable(
  namespace: Namespace,
  componentOf: UAObject,
  name: keyof SimulatorState,
) {
  const dataType = name === "Target_X" || name === "Target_Y" || name === "Actual_X" || name === "Actual_Y"
    ? DataType.Double
    : dataTypeForValue(runtime.state[name]);

  namespace.addVariable({
    componentOf,
    browseName: name,
    nodeId: nodeId(name),
    dataType,
    minimumSamplingInterval: 100,
    value: {
      get: () => new Variant({
        dataType,
        value: runtime.state[name],
      }),
      set: (variant: Variant) => {
        if (name === "Cmd_Trigger") {
          const result = runtime.pulseTrigger(Boolean(variant.value));
          if (result) {
            console.log(`[opc-simulator] command code=${runtime.state.Cmd_Code} seq=${runtime.state.Cmd_Seq} result=${result.result}`);
            if (result.action) {
              scheduleAction(result.action);
            }
            if (runtime.state.Machine_State === 2) {
              clearActionTimers();
            }
            if (result.accepted && runtime.state.Machine_State === 1 && !completionTimer && currentAction) {
              scheduleAction(currentAction);
            }
          }
        } else {
          runtime.setValue(name, variant.value);
        }
        return StatusCodes.Good;
      },
    },
  });
}

async function main() {
  const server = new OPCUAServer({
    port: PORT,
    resourcePath: RESOURCE_PATH,
    buildInfo: {
      productName: "stacker-web-opc-simulator",
      buildNumber: "2",
      buildDate: new Date(),
    },
  });

  await server.initialize();

  const addressSpace = server.engine.addressSpace;
  if (!addressSpace) {
    throw new Error("OPC UA address space is not available.");
  }

  const namespace = addressSpace.getOwnNamespace();
  const root = addressSpace.rootFolder.objects;
  const stacker = namespace.addFolder(root, { browseName: "Stacker" });

  (Object.keys(runtime.state) as Array<keyof SimulatorState>).forEach((name) => {
    addVariable(namespace, stacker, name);
  });

  await server.start();
  const heartbeatTimer = setInterval(() => runtime.tickHeartbeat(), HEARTBEAT_MS);

  console.log(`[opc-simulator] OPC UA server listening on ${server.getEndpointUrl()}`);
  console.log("[opc-simulator] protocol=single-package Cmd/Target/Trace/Ack/Step");

  const shutdown = async () => {
    clearInterval(heartbeatTimer);
    clearActionTimers();
    await server.shutdown(1000);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error("[opc-simulator] failed to start", error);
  process.exit(1);
});
