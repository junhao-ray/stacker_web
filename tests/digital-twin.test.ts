import { describe, expect, it } from "vitest";

import { buildTwinSnapshot, getTwinConfig, getTwinRackSlots } from "@/lib/digital-twin";
import { createDefaultRackConfig, getRackLevelLayouts } from "@/lib/rack-config";
import { OUTBOUND_TASKS } from "@/lib/mock-data";

describe("digital twin mock config", () => {
  it("uses the physical 1.8m x 2m four-level rack config", () => {
    const config = getTwinConfig();

    expect(config.xAxisMeters).toBe(1.8);
    expect(config.zAxisMeters).toBe(2);
    expect(config.rackLengthMm).toBe(1800);
    expect(config.rackHeightMm).toBe(2000);
    expect(config.rackLevels).toBe(4);
    expect(config.defaultGapMm).toBe(10);
  });

  it("builds slots from mixed-width rack rows across upper and lower racks", () => {
    const rackConfig = createDefaultRackConfig();
    const layouts = getRackLevelLayouts(rackConfig);
    const slots = getTwinRackSlots(rackConfig);
    const distinctRowCounts = new Set(layouts.map((layout) => layout.slotCount));

    expect(slots).toHaveLength(layouts.reduce((sum, layout) => sum + layout.slotCount, 0));
    expect(layouts).toHaveLength(8);
    expect(distinctRowCounts.size).toBeGreaterThan(1);
    expect(slots.every((slot) => slot.widthMm > 0 && slot.xCenterMm > slot.xStartMm)).toBe(true);
    expect(slots.every((slot) => slot.xStartMm + slot.widthMm <= rackConfig.rackLengthMm)).toBe(true);
  });

  it("emits snapshots aligned with variable-width slots", () => {
    const snapshot = buildTwinSnapshot();
    const maxColumn = Math.max(...snapshot.slots.map((slot) => slot.column));

    expect(snapshot.config.rackColumns).toBe(maxColumn);
    expect(snapshot.config.rackLevels).toBe(4);
    expect(snapshot.slots.every((slot) => slot.level >= 1 && slot.level <= 4)).toBe(true);
    expect(snapshot.activeTask?.steps.every((step) => snapshot.slots.some((slot) => slot.id === step.slotId)) ?? true).toBe(true);
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
    expect(activeTask?.steps.every((step) => snapshot.slots.some((slot) => slot.id === step.slotId))).toBe(true);
  });
});
