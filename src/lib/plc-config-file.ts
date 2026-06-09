import fs from "node:fs";
import path from "node:path";

import {
  clonePlcGatewayConfigFormValue,
  createDefaultPlcGatewayConfigFormValue,
  type PlcGatewayConfigFormValue,
} from "@/lib/plc-config";

function resolveGatewayRoot() {
  return path.resolve(process.cwd(), "services/opc-gateway");
}

export function resolvePlcConfigPath() {
  return process.env.PLC_GATEWAY_CONFIG_PATH
    ? path.resolve(process.env.PLC_GATEWAY_CONFIG_PATH)
    : path.join(resolveGatewayRoot(), "config", "plc-config.json");
}

export function resolvePlcTemplateConfigPath() {
  return path.join(resolveGatewayRoot(), "config", "plc-config.template.json");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readConfigFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

export function normalizePlcGatewayConfigFormValue(raw: unknown): PlcGatewayConfigFormValue {
  const defaults = createDefaultPlcGatewayConfigFormValue();
  if (!isObject(raw)) {
    return defaults;
  }

  const sideMapping = isObject(raw.sideMapping) ? raw.sideMapping : {};
  const commandCodes = isObject(raw.commandCodes) ? raw.commandCodes : {};
  const nodes = isObject(raw.nodes) ? raw.nodes : {};
  const command = isObject(nodes.command) ? nodes.command : {};
  const target = isObject(nodes.target) ? nodes.target : {};
  const trace = isObject(nodes.trace) ? nodes.trace : {};
  const ack = isObject(nodes.ack) ? nodes.ack : {};
  const machine = isObject(nodes.machine) ? nodes.machine : {};
  const diagnostics = isObject(nodes.diagnostics) ? nodes.diagnostics : {};

  return {
    endpointUrl: readString(raw.endpointUrl, defaults.endpointUrl),
    securityMode: readString(raw.securityMode, defaults.securityMode) as PlcGatewayConfigFormValue["securityMode"],
    securityPolicy: readString(raw.securityPolicy, defaults.securityPolicy) as PlcGatewayConfigFormValue["securityPolicy"],
    requestedSessionTimeoutMs: readNumber(raw.requestedSessionTimeoutMs, defaults.requestedSessionTimeoutMs),
    ackTimeoutMs: readNumber(raw.ackTimeoutMs, defaults.ackTimeoutMs),
    stepDoneTimeoutMs: readNumber(raw.stepDoneTimeoutMs, defaults.stepDoneTimeoutMs),
    reconnectIntervalMs: readNumber(raw.reconnectIntervalMs, defaults.reconnectIntervalMs),
    pulseDurationMs: readNumber(raw.pulseDurationMs, defaults.pulseDurationMs),
    pollIntervalMs: readNumber(raw.pollIntervalMs, defaults.pollIntervalMs),
    sideMapping: {
      left: readNumber(sideMapping.left, defaults.sideMapping.left),
      right: readNumber(sideMapping.right, defaults.sideMapping.right),
    },
    commandCodes: {
      pickToBin: readNumber(commandCodes.pickToBin, defaults.commandCodes.pickToBin),
      releaseBin: readNumber(commandCodes.releaseBin, defaults.commandCodes.releaseBin),
      pause: readNumber(commandCodes.pause, defaults.commandCodes.pause),
      resume: readNumber(commandCodes.resume, defaults.commandCodes.resume),
      home: readNumber(commandCodes.home, defaults.commandCodes.home),
      resetAlarm: readNumber(commandCodes.resetAlarm, defaults.commandCodes.resetAlarm),
    },
    nodes: {
      command: {
        seq: readString(command.seq),
        code: readString(command.code),
        trigger: readString(command.trigger),
      },
      target: {
        x: readString(target.x),
        y: readString(target.y),
        side: readString(target.side),
        qty: readString(target.qty),
      },
      trace: {
        taskNo: readString(trace.taskNo),
        orderNo: readString(trace.orderNo),
        stepId: readString(trace.stepId),
        productCode: readString(trace.productCode),
        slotId: readString(trace.slotId),
      },
      ack: {
        seq: readString(ack.seq),
        code: readString(ack.code),
        result: readString(ack.result),
      },
      machine: {
        state: readString(machine.state),
        stepBusy: readString(machine.stepBusy),
        stepDone: readString(machine.stepDone),
        currentSeq: readString(machine.currentSeq),
        currentStepId: readString(machine.currentStepId),
        actualX: readString(machine.actualX),
        actualY: readString(machine.actualY),
        alarm: readString(machine.alarm),
        errorCode: readString(machine.errorCode),
        errorMessage: readString(machine.errorMessage),
      },
      diagnostics: {
        heartbeat: readString(diagnostics.heartbeat),
        motionPhase: readString(diagnostics.motionPhase),
        vacuumOn: readString(diagnostics.vacuumOn),
        vacuumOk: readString(diagnostics.vacuumOk),
        cylinderExtended: readString(diagnostics.cylinderExtended),
        cylinderRetracted: readString(diagnostics.cylinderRetracted),
        axisXInPosition: readString(diagnostics.axisXInPosition),
        axisYInPosition: readString(diagnostics.axisYInPosition),
        safetyOk: readString(diagnostics.safetyOk),
        doorClosed: readString(diagnostics.doorClosed),
        estopOk: readString(diagnostics.estopOk),
      },
    },
  };
}

export function readPlcGatewayConfigFormValue() {
  const configPath = resolvePlcConfigPath();
  const templatePath = resolvePlcTemplateConfigPath();
  const raw = readConfigFile(configPath) ?? readConfigFile(templatePath);
  const value = normalizePlcGatewayConfigFormValue(raw);

  return {
    path: configPath,
    exists: fs.existsSync(configPath),
    value: clonePlcGatewayConfigFormValue(value),
  };
}

export function writePlcGatewayConfigFormValue(value: PlcGatewayConfigFormValue) {
  const filePath = resolvePlcConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  return {
    path: filePath,
    exists: true,
    value: clonePlcGatewayConfigFormValue(value),
  };
}

export function readPlcTemplateGatewayConfigFormValue() {
  const templatePath = resolvePlcTemplateConfigPath();
  const raw = readConfigFile(templatePath);
  const value = normalizePlcGatewayConfigFormValue(raw);

  return {
    path: templatePath,
    exists: fs.existsSync(templatePath),
    value: clonePlcGatewayConfigFormValue(value),
  };
}
