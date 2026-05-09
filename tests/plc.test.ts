import { describe, expect, it } from "vitest";

import {
  buildPickToBinPayload,
  getTemporaryPickCoordinate,
  parsePlcCommandRequest,
  PlcRequestValidationError,
} from "@/lib/plc";
import type { TwinQueueTask } from "@/lib/types";

function createTask(stepCount = 2): TwinQueueTask {
  return {
    taskNo: "CK20260422001",
    orderNo: "SO-10001",
    status: "pending",
    createdAt: "2026-04-22 10:00:00",
    operator: "tester",
    stepCount,
    totalQuantity: stepCount,
    completedSteps: 0,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      taskNo: "CK20260422001",
      productCode: `SKU-${index + 1}`,
      productName: `Material ${index + 1}`,
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
  it("accepts pickToBin with a single-package payload", () => {
    const result = parsePlcCommandRequest({
      command: "pickToBin",
      payload: {
        taskNo: "T-1",
        orderNo: "O-1",
        stepId: "STEP-1",
        productCode: "SKU-1",
        slotId: "left-01-01",
        targetX: 133,
        targetY: 111,
        targetSide: 1,
        targetQty: 1,
      },
    });

    expect(result.command).toBe("pickToBin");
    expect(result.payload?.stepId).toBe("STEP-1");
  });

  it("rejects pickToBin without required target fields", () => {
    expect(() => parsePlcCommandRequest({
      command: "pickToBin",
      payload: {
        taskNo: "T-1",
        orderNo: "O-1",
        productCode: "SKU-1",
        slotId: "left-01-01",
        targetSide: 1,
        targetQty: 1,
      },
    })).toThrow(PlcRequestValidationError);
  });

  it("rejects non-pick commands with payload", () => {
    expect(() => parsePlcCommandRequest({
      command: "pause",
      payload: {
        taskNo: "T-1",
      },
    })).toThrow(PlcRequestValidationError);
  });

  it("accepts control commands without payload", () => {
    expect(parsePlcCommandRequest({ command: "releaseBin" })).toEqual({ command: "releaseBin" });
    expect(parsePlcCommandRequest({ command: "home" })).toEqual({ command: "home" });
    expect(parsePlcCommandRequest({ command: "resetAlarm" })).toEqual({ command: "resetAlarm" });
  });
});

describe("temporary pick coordinates", () => {
  it("cycles through the ten fixed points", () => {
    expect(getTemporaryPickCoordinate(0)).toEqual({ x: 0, y: 0 });
    expect(getTemporaryPickCoordinate(9)).toEqual({ x: 1200, y: 1000 });
    expect(getTemporaryPickCoordinate(10)).toEqual({ x: 0, y: 0 });
  });

  it("builds a pick payload from a queue task step", () => {
    const task = createTask(12);
    const payload = buildPickToBinPayload(task, task.steps[10], 10);

    expect(payload).toEqual({
      taskNo: "CK20260422001",
      orderNo: "SO-10001",
      stepId: "step-11",
      productCode: "SKU-11",
      slotId: "left-011-01",
      targetX: 0,
      targetY: 0,
      targetSide: 1,
      targetQty: 1,
    });
  });
});
