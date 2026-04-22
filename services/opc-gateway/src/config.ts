import fs from "node:fs";
import path from "node:path";

import type { GatewayConfig, GatewayNodeMap } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeNodeMap(raw: unknown): GatewayNodeMap {
  const value = isObject(raw) ? raw : {};
  const command = isObject(value.command) ? value.command : {};
  const ack = isObject(value.ack) ? value.ack : {};
  const machine = isObject(value.machine) ? value.machine : {};
  const task = isObject(value.task) ? value.task : {};
  const header = isObject(task.header) ? task.header : {};
  const steps = Array.isArray(task.steps) ? task.steps : [];

  return {
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
  };
}

function readConfigFile(configPath: string) {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const content = fs.readFileSync(configPath, "utf8");
  return JSON.parse(content) as unknown;
}

export function loadGatewayConfig(): GatewayConfig {
  const rootDir = path.resolve(process.cwd(), "services/opc-gateway");
  const configPath = process.env.PLC_GATEWAY_CONFIG_PATH
    ? path.resolve(process.env.PLC_GATEWAY_CONFIG_PATH)
    : path.join(rootDir, "config", "plc-config.json");
  const raw = readConfigFile(configPath);
  const config = isObject(raw) ? raw : {};
  const sideMapping = isObject(config.sideMapping) ? config.sideMapping : {};
  const commandCodes = isObject(config.commandCodes) ? config.commandCodes : {};

  return {
    endpointUrl: process.env.OPC_UA_ENDPOINT_URL ?? readString(config.endpointUrl, "opc.tcp://127.0.0.1:4840"),
    securityMode: process.env.OPC_UA_SECURITY_MODE ?? readString(config.securityMode, "None"),
    securityPolicy: process.env.OPC_UA_SECURITY_POLICY ?? readString(config.securityPolicy, "None"),
    requestedSessionTimeoutMs: readNumber(config.requestedSessionTimeoutMs, 20_000),
    ackTimeoutMs: readNumber(config.ackTimeoutMs, 3_000),
    reconnectIntervalMs: readNumber(config.reconnectIntervalMs, 2_000),
    pulseDurationMs: readNumber(config.pulseDurationMs, 120),
    pollIntervalMs: readNumber(config.pollIntervalMs, 1_000),
    sideMapping: {
      left: readNumber(sideMapping.left, 1),
      right: readNumber(sideMapping.right, 2),
    },
    commandCodes: {
      dispatchTask: readNumber(commandCodes.dispatchTask, 10),
      start: readNumber(commandCodes.start, 20),
      pause: readNumber(commandCodes.pause, 30),
      resume: readNumber(commandCodes.resume, 40),
      reset: readNumber(commandCodes.reset, 50),
    },
    nodes: normalizeNodeMap(config.nodes),
  };
}

export function isGatewayConfigured(config: GatewayConfig) {
  const { nodes } = config;
  const requiredScalars = [
    nodes.command.code,
    nodes.command.seq,
    nodes.command.trigger,
    nodes.ack.lastAckSeq,
    nodes.ack.lastAckCode,
    nodes.ack.lastAckResult,
    nodes.machine.state,
    nodes.machine.currentTaskNo,
    nodes.machine.alarm,
    nodes.machine.errorCode,
    nodes.machine.errorMessage,
    nodes.task.header.taskNo,
    nodes.task.header.orderNo,
    nodes.task.header.stepCount,
  ];

  if (requiredScalars.some((value) => !value)) {
    return false;
  }

  return nodes.task.steps.length > 0 && nodes.task.steps.every((step) => Object.values(step).every(Boolean));
}
