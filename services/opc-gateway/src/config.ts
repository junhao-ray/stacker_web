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
  const target = isObject(value.target) ? value.target : {};
  const trace = isObject(value.trace) ? value.trace : {};
  const ack = isObject(value.ack) ? value.ack : {};
  const machine = isObject(value.machine) ? value.machine : {};
  const diagnostics = isObject(value.diagnostics) ? value.diagnostics : {};

  return {
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
    stepDoneTimeoutMs: readNumber(config.stepDoneTimeoutMs, 30_000),
    reconnectIntervalMs: readNumber(config.reconnectIntervalMs, 2_000),
    pulseDurationMs: readNumber(config.pulseDurationMs, 120),
    pollIntervalMs: readNumber(config.pollIntervalMs, 1_000),
    sideMapping: {
      left: readNumber(sideMapping.left, 1),
      right: readNumber(sideMapping.right, 2),
    },
    commandCodes: {
      pickToBin: readNumber(commandCodes.pickToBin, 100),
      releaseBin: readNumber(commandCodes.releaseBin, 110),
      pause: readNumber(commandCodes.pause, 120),
      resume: readNumber(commandCodes.resume, 130),
      home: readNumber(commandCodes.home, 140),
      resetAlarm: readNumber(commandCodes.resetAlarm, 150),
    },
    nodes: normalizeNodeMap(config.nodes),
  };
}

export function isGatewayConfigured(config: GatewayConfig) {
  const { nodes } = config;
  const requiredScalars = [
    nodes.command.seq,
    nodes.command.code,
    nodes.command.trigger,
    nodes.target.x,
    nodes.target.y,
    nodes.target.side,
    nodes.target.qty,
    nodes.trace.taskNo,
    nodes.trace.orderNo,
    nodes.trace.stepId,
    nodes.trace.productCode,
    nodes.trace.slotId,
    nodes.ack.seq,
    nodes.ack.code,
    nodes.ack.result,
    nodes.machine.state,
    nodes.machine.stepBusy,
    nodes.machine.stepDone,
    nodes.machine.currentSeq,
    nodes.machine.currentStepId,
    nodes.machine.actualX,
    nodes.machine.actualY,
    nodes.machine.alarm,
    nodes.machine.errorCode,
    nodes.machine.errorMessage,
  ];

  return requiredScalars.every(Boolean);
}
