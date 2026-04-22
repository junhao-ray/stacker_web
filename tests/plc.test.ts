import { describe, expect, it } from "vitest";

import { buildDispatchTaskPayload, parsePlcCommandRequest, PlcRequestValidationError } from "@/lib/plc";
import type { TwinQueueTask } from "@/lib/types";

function createTask(stepCount = 2): TwinQueueTask {
  return {
    taskNo: "CK20260422001",
    orderNo: "SO-10001",
    status: "pending",
    createdAt: "2026-04-22 10:00:00",
    operator: "测试员",
    stepCount,
    totalQuantity: stepCount * 2,
    completedSteps: 0,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      taskNo: "CK20260422001",
      productCode: `SKU-${index + 1}`,
      productName: `物料 ${index + 1}`,
      quantity: 2,
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
            quantity: 2,
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

  it("rejects too many task steps", () => {
    expect(() => parsePlcCommandRequest({
      command: "dispatchTask",
      task: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepCount: 33,
        steps: Array.from({ length: 33 }, (_, index) => ({
          index: index + 1,
          productCode: `SKU-${index + 1}`,
          quantity: 1,
          side: "left",
          column: 1,
          level: 1,
          slotId: `S-${index + 1}`,
        })),
      },
    })).toThrow(/不能超过 32/);
  });
});

describe("buildDispatchTaskPayload", () => {
  it("maps queue task steps into PLC payload", () => {
    const payload = buildDispatchTaskPayload(createTask(2));

    expect(payload.taskNo).toBe("CK20260422001");
    expect(payload.stepCount).toBe(2);
    expect(payload.steps[0]).toEqual({
      index: 1,
      productCode: "SKU-1",
      quantity: 2,
      side: "left",
      column: 1,
      level: 1,
      slotId: "left-01-01",
    });
  });
});
