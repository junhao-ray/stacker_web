import type {
  PlcCommand,
  PlcCommandRequest,
  PlcPickToBinPayload,
  PlcStatusSnapshot,
  TwinPickStep,
  TwinQueueTask,
} from "@/lib/types";

export const PLC_MAX_STRING_LENGTH = 64;
export const PLC_COMMANDS: PlcCommand[] = [
  "pickToBin",
  "releaseBin",
  "pause",
  "resume",
  "home",
  "resetAlarm",
];

export const PLC_TEMP_PICK_COORDINATES = [
  { x: 0, y: 0 },
  { x: 133, y: 111 },
  { x: 267, y: 222 },
  { x: 400, y: 333 },
  { x: 533, y: 444 },
  { x: 667, y: 556 },
  { x: 800, y: 667 },
  { x: 933, y: 778 },
  { x: 1067, y: 889 },
  { x: 1200, y: 1000 },
] as const;

export class PlcRequestValidationError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "invalid_request") {
    super(message);
    this.name = "PlcRequestValidationError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown, label: string, maxLength = PLC_MAX_STRING_LENGTH) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlcRequestValidationError(`${label} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PlcRequestValidationError(`${label} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function isFiniteNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PlcRequestValidationError(`${label} must be a finite number`);
  }

  return value;
}

function isPositiveInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new PlcRequestValidationError(`${label} must be a positive integer`);
  }

  return Number(value);
}

function isTargetSide(value: unknown) {
  const side = isPositiveInteger(value, "payload.targetSide");
  if (side !== 1 && side !== 2) {
    throw new PlcRequestValidationError("payload.targetSide must be 1 or 2");
  }
  return side;
}

function isPickToBinPayload(value: unknown): PlcPickToBinPayload {
  if (!isObject(value)) {
    throw new PlcRequestValidationError("payload is required for pickToBin");
  }

  return {
    taskNo: isNonEmptyString(value.taskNo, "payload.taskNo"),
    orderNo: isNonEmptyString(value.orderNo, "payload.orderNo"),
    stepId: isNonEmptyString(value.stepId, "payload.stepId"),
    productCode: isNonEmptyString(value.productCode, "payload.productCode"),
    slotId: isNonEmptyString(value.slotId, "payload.slotId"),
    targetX: isFiniteNumber(value.targetX, "payload.targetX"),
    targetY: isFiniteNumber(value.targetY, "payload.targetY"),
    targetSide: isTargetSide(value.targetSide),
    targetQty: isPositiveInteger(value.targetQty, "payload.targetQty"),
  };
}

export function parsePlcCommandRequest(body: unknown): PlcCommandRequest {
  if (!isObject(body)) {
    throw new PlcRequestValidationError("Request body must be a JSON object");
  }

  const commandValue = body.command;
  if (typeof commandValue !== "string" || !PLC_COMMANDS.includes(commandValue as PlcCommand)) {
    throw new PlcRequestValidationError("command is invalid");
  }
  const command = commandValue as PlcCommand;

  if (command === "pickToBin") {
    return {
      command,
      payload: isPickToBinPayload(body.payload),
    };
  }

  if (typeof body.payload !== "undefined") {
    throw new PlcRequestValidationError(`${command} cannot include payload`);
  }

  return { command };
}

export function getTemporaryPickCoordinate(stepIndex: number) {
  const safeIndex = Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : 0;
  return PLC_TEMP_PICK_COORDINATES[safeIndex % PLC_TEMP_PICK_COORDINATES.length];
}

export function buildPickToBinPayload(
  task: TwinQueueTask,
  step: TwinPickStep,
  stepIndex: number,
): PlcPickToBinPayload {
  const coordinate = getTemporaryPickCoordinate(stepIndex);

  return {
    taskNo: task.taskNo,
    orderNo: task.orderNo,
    stepId: step.id,
    productCode: step.productCode,
    slotId: step.slotId,
    targetX: coordinate.x,
    targetY: coordinate.y,
    targetSide: step.side === "left" ? 1 : 2,
    targetQty: 1,
  };
}

export function emptyPlcStatusSnapshot(): PlcStatusSnapshot {
  return {
    configured: false,
    connected: false,
    machineState: "unknown",
    currentTaskNo: null,
    currentSeq: null,
    currentStepId: null,
    stepBusy: false,
    stepDone: false,
    actualX: null,
    actualY: null,
    alarm: false,
    errorCode: null,
    errorMessage: null,
    commandInFlight: false,
    lastCommand: null,
    updatedAt: new Date(0).toISOString(),
  };
}
