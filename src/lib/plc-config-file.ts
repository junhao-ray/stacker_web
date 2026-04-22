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
  const ack = isObject(nodes.ack) ? nodes.ack : {};
  const machine = isObject(nodes.machine) ? nodes.machine : {};
  const task = isObject(nodes.task) ? nodes.task : {};
  const header = isObject(task.header) ? task.header : {};
  const steps = Array.isArray(task.steps) ? task.steps : defaults.nodes.task.steps;

  return {
    endpointUrl: readString(raw.endpointUrl, defaults.endpointUrl),
    securityMode: readString(raw.securityMode, defaults.securityMode) as PlcGatewayConfigFormValue["securityMode"],
    securityPolicy: readString(raw.securityPolicy, defaults.securityPolicy) as PlcGatewayConfigFormValue["securityPolicy"],
    requestedSessionTimeoutMs: readNumber(raw.requestedSessionTimeoutMs, defaults.requestedSessionTimeoutMs),
    ackTimeoutMs: readNumber(raw.ackTimeoutMs, defaults.ackTimeoutMs),
    reconnectIntervalMs: readNumber(raw.reconnectIntervalMs, defaults.reconnectIntervalMs),
    pulseDurationMs: readNumber(raw.pulseDurationMs, defaults.pulseDurationMs),
    pollIntervalMs: readNumber(raw.pollIntervalMs, defaults.pollIntervalMs),
    sideMapping: {
      left: readNumber(sideMapping.left, defaults.sideMapping.left),
      right: readNumber(sideMapping.right, defaults.sideMapping.right),
    },
    commandCodes: {
      dispatchTask: readNumber(commandCodes.dispatchTask, defaults.commandCodes.dispatchTask),
      start: readNumber(commandCodes.start, defaults.commandCodes.start),
      pause: readNumber(commandCodes.pause, defaults.commandCodes.pause),
      resume: readNumber(commandCodes.resume, defaults.commandCodes.resume),
      reset: readNumber(commandCodes.reset, defaults.commandCodes.reset),
    },
    nodes: {
      command: {
        code: readString(command.code),
        seq: readString(command.seq),
        trigger: readString(command.trigger),
      },
      ack: {
        lastAckSeq: readString(ack.lastAckSeq),
        lastAckCode: readString(ack.lastAckCode),
        lastAckResult: readString(ack.lastAckResult),
      },
      machine: {
        state: readString(machine.state),
        currentTaskNo: readString(machine.currentTaskNo),
        alarm: readString(machine.alarm),
        errorCode: readString(machine.errorCode),
        errorMessage: readString(machine.errorMessage),
      },
      task: {
        header: {
          taskNo: readString(header.taskNo),
          orderNo: readString(header.orderNo),
          stepCount: readString(header.stepCount),
        },
        steps: steps.map((step) => {
          const entry = isObject(step) ? step : {};
          return {
            index: readString(entry.index),
            productCode: readString(entry.productCode),
            quantity: readString(entry.quantity),
            side: readString(entry.side),
            column: readString(entry.column),
            level: readString(entry.level),
            slotId: readString(entry.slotId),
          };
        }),
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
