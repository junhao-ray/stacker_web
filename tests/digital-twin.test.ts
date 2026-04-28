import { describe, expect, it } from "vitest";

import { buildTwinSnapshot, getTwinConfig, getTwinRackSlots } from "@/lib/digital-twin";
import { OUTBOUND_TASKS } from "@/lib/mock-data";

describe("digital twin mock config", () => {
  it("uses 30 rack columns within a 5 meter x-axis", () => {
    const config = getTwinConfig();

    expect(config.xAxisMeters).toBe(5);
    expect(config.rackColumns).toBe(30);
    expect(config.columnPitchMeters).toBeCloseTo(5 / 30, 5);
  });

  it("builds 480 rack slots across upper and lower racks", () => {
    const slots = getTwinRackSlots();

    expect(slots).toHaveLength(480);
  });

  it("emits snapshots aligned with the 30-column layout", () => {
    const snapshot = buildTwinSnapshot();

    expect(snapshot.config.rackColumns).toBe(30);
    expect(snapshot.slots).toHaveLength(480);
    expect(snapshot.activeTask?.steps.every((step) => step.column >= 1 && step.column <= 30) ?? true).toBe(true);
  });

  it("expands active task items into one-package pick steps", () => {
    const snapshot = buildTwinSnapshot();
    const activeTask = snapshot.activeTask;
    const sourceTask = OUTBOUND_TASKS.find((task) => task.taskNo === activeTask?.taskNo);

    expect(activeTask).not.toBeNull();
    expect(sourceTask).toBeDefined();

    const expectedPackageCount = sourceTask?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    expect(activeTask?.steps).toHaveLength(expectedPackageCount);
    expect(activeTask?.stepCount).toBe(expectedPackageCount);
    expect(activeTask?.totalQuantity).toBe(expectedPackageCount);
    expect(activeTask?.steps.every((step) => step.quantity === 1)).toBe(true);
    expect(activeTask?.steps.every((step) => step.slotId.length > 0)).toBe(true);
    expect(activeTask?.steps.every((step) => step.column >= 1 && step.column <= 30)).toBe(true);
  });
});
