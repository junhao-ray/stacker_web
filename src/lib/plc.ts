import type {
  DispatchTaskPayload,
  DispatchTaskStep,
  PlcCommand,
  PlcCommandRequest,
  PlcStatusSnapshot,
  TwinQueueTask,
} from "@/lib/types";

export const PLC_MAX_TASK_STEPS = 32;
export const PLC_MAX_STRING_LENGTH = 64;

export const PLC_COMMANDS: PlcCommand[] = ["dispatchTask", "start", "pause", "resume", "reset"];

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
    throw new PlcRequestValidationError(`${label} 不能为空`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PlcRequestValidationError(`${label} 长度不能超过 ${maxLength}`);
  }

  return normalized;
}

function isPositiveInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new PlcRequestValidationError(`${label} 必须为正整数`);
  }

  return Number(value);
}

function isTaskStep(value: unknown, position: number): DispatchTaskStep {
  if (!isObject(value)) {
    throw new PlcRequestValidationError(`steps[${position}] 必须为对象`);
  }

  const side = value.side;
  if (side !== "left" && side !== "right") {
    throw new PlcRequestValidationError(`steps[${position}].side 必须为 left 或 right`);
  }

  return {
    index: isPositiveInteger(value.index, `steps[${position}].index`),
    productCode: isNonEmptyString(value.productCode, `steps[${position}].productCode`),
    quantity: isPositiveInteger(value.quantity, `steps[${position}].quantity`),
    side,
    column: isPositiveInteger(value.column, `steps[${position}].column`),
    level: isPositiveInteger(value.level, `steps[${position}].level`),
    slotId: isNonEmptyString(value.slotId, `steps[${position}].slotId`),
  };
}

function isDispatchTask(value: unknown): DispatchTaskPayload {
  if (!isObject(value)) {
    throw new PlcRequestValidationError("task 必须为对象");
  }

  if (!Array.isArray(value.steps)) {
    throw new PlcRequestValidationError("task.steps 必须为数组");
  }

  if (value.steps.length === 0) {
    throw new PlcRequestValidationError("task.steps 不能为空");
  }

  if (value.steps.length > PLC_MAX_TASK_STEPS) {
    throw new PlcRequestValidationError(`task.steps 不能超过 ${PLC_MAX_TASK_STEPS} 条`, 400, "task_steps_exceeded");
  }

  const steps = value.steps.map((step, index) => isTaskStep(step, index));
  const stepCount = isPositiveInteger(value.stepCount, "task.stepCount");

  if (stepCount !== steps.length) {
    throw new PlcRequestValidationError("task.stepCount 必须与 steps.length 一致");
  }

  return {
    taskNo: isNonEmptyString(value.taskNo, "task.taskNo"),
    orderNo: isNonEmptyString(value.orderNo, "task.orderNo"),
    stepCount,
    steps,
  };
}

export function parsePlcCommandRequest(body: unknown): PlcCommandRequest {
  if (!isObject(body)) {
    throw new PlcRequestValidationError("请求体必须为 JSON 对象");
  }

  const commandValue = body.command;
  if (typeof commandValue !== "string" || !PLC_COMMANDS.includes(commandValue as PlcCommand)) {
    throw new PlcRequestValidationError("command 不合法");
  }
  const command = commandValue as PlcCommand;

  if (command === "dispatchTask") {
    return {
      command,
      task: isDispatchTask(body.task),
    };
  }

  if (typeof body.task !== "undefined") {
    throw new PlcRequestValidationError(`${command} 命令不能携带 task`);
  }

  return { command };
}

export function buildDispatchTaskPayload(task: TwinQueueTask): DispatchTaskPayload {
  const steps = task.steps.map<DispatchTaskStep>((step, index) => ({
    index: index + 1,
    productCode: step.productCode,
    quantity: step.quantity,
    side: step.side,
    column: step.column,
    level: step.level,
    slotId: step.slotId,
  }));

  if (steps.length > PLC_MAX_TASK_STEPS) {
    throw new PlcRequestValidationError(`任务 ${task.taskNo} 超过最大步骤数 ${PLC_MAX_TASK_STEPS}`, 400, "task_steps_exceeded");
  }

  return {
    taskNo: task.taskNo,
    orderNo: task.orderNo,
    stepCount: steps.length,
    steps,
  };
}

export function emptyPlcStatusSnapshot(): PlcStatusSnapshot {
  return {
    configured: false,
    connected: false,
    machineState: "unknown",
    currentTaskNo: null,
    commandInFlight: false,
    lastCommand: null,
    updatedAt: new Date(0).toISOString(),
  };
}
