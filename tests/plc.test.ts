import { describe, expect, it } from "vitest";

import { buildDispatchTaskPayload, parsePlcCommandRequest, PlcRequestValidationError, PLC_MAX_TASK_STEPS } from "@/lib/plc";
import type { TwinQueueTask } from "@/lib/types";

function createTask(stepCount = 2): TwinQueueTask {
  return {
    taskNo: "CK20260422001",
    orderNo: "SO-10001",
    status: "pending",
    createdAt: "2026-04-22 10:00:00",
    operator: "测试员",
    stepCount,
    totalQuantity: stepCount,
    completedSteps: 0,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      taskNo: "CK20260422001",
      productCode: `SKU-${index + 1}`,
      productName: `物料 ${index + 1}`,
      quantity: 1,
      slotId: `left-0${index + 1}-01`,
      side: "left",
      column: index + 1,
      level: 1,
      status: "pending",
    })),
  };
}

describe("parsePlcCommandRequest", () => {
  it("accepts dispatchTask with task payload", () => {
    const result = parsePlcCommandRequest({
      command: "dispatchTask",
      task: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepCount: 1,
        steps: [
          {
            index: 1,
            productCode: "SKU-1",
            quantity: 1,
            side: "left",
            column: 1,
            level: 1,
            slotId: "left-01-01",
          },
        ],
      },
    });

    expect(result.command).toBe("dispatchTask");
    expect(result.task?.stepCount).toBe(1);
  });

  it("rejects non-dispatch commands with task payload", () => {
    expect(() => parsePlcCommandRequest({
      command: "start",
      task: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepCount: 1,
        steps: [],
      },
    })).toThrow(PlcRequestValidationError);
  });

  it("accepts package-level payloads above the old 32-step limit", () => {
    const stepCount = 33;
    const result = parsePlcCommandRequest({
      command: "dispatchTask",
      task: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepCount,
        steps: Array.from({ length: stepCount }, (_, index) => ({
          index: index + 1,
          productCode: `SKU-${index + 1}`,
          quantity: 1,
          side: "left",
          column: 1,
          level: 1,
          slotId: `S-${index + 1}`,
        })),
      },
    });

    expect(result.task?.stepCount).toBe(stepCount);
  });

  it("rejects too many task steps", () => {
    const stepCount = PLC_MAX_TASK_STEPS + 1;

    expect(() => parsePlcCommandRequest({
      command: "dispatchTask",
      task: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepCount,
        steps: Array.from({ length: stepCount }, (_, index) => ({
          index: index + 1,
          productCode: `SKU-${index + 1}`,
          quantity: 1,
          side: "left",
          column: 1,
          level: 1,
          slotId: `S-${index + 1}`,
        })),
      },
    })).toThrow(`不能超过 ${PLC_MAX_TASK_STEPS}`);
  });
});

describe("buildDispatchTaskPayload", () => {
  it("maps queue task package steps into PLC payload", () => {
    const payload = buildDispatchTaskPayload(createTask(34));

    expect(payload.taskNo).toBe("CK20260422001");
    expect(payload.stepCount).toBe(34);
    expect(payload.steps.every((step) => step.quantity === 1)).toBe(true);
    expect(payload.steps[0]).toEqual({
      index: 1,
      productCode: "SKU-1",
      quantity: 1,
      side: "left",
      column: 1,
      level: 1,
      slotId: "left-01-01",
    });
  });

  it("rejects package payloads above the configured PLC step limit", () => {
    expect(() => buildDispatchTaskPayload(createTask(PLC_MAX_TASK_STEPS + 1))).toThrow(
      `超过最大步骤数 ${PLC_MAX_TASK_STEPS}`,
    );
  });
});
