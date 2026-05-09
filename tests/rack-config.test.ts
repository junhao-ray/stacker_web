import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertValidRackConfig,
  createDefaultRackConfig,
  expandRackLevelItems,
  getRackLevelLayouts,
  normalizeRackConfig,
  RackConfigValidationError,
} from "@/lib/rack-config";
import {
  readRackConfigFormValue,
  writeRackConfigFormValue,
} from "@/lib/rack-config-file";

const originalRackConfigPath = process.env.RACK_CONFIG_PATH;

afterEach(() => {
  if (typeof originalRackConfigPath === "string") {
    process.env.RACK_CONFIG_PATH = originalRackConfigPath;
  } else {
    delete process.env.RACK_CONFIG_PATH;
  }
});

describe("rack config layout", () => {
  it("normalizes empty input to the physical rack defaults", () => {
    const config = normalizeRackConfig({});

    expect(config.rackLengthMm).toBe(1800);
    expect(config.rackHeightMm).toBe(2000);
    expect(config.rackLevels).toBe(4);
    expect(config.defaultGapMm).toBe(10);
    expect(config.sides).toHaveLength(2);
    expect(config.sides.every((side) => side.levels.length === 4)).toBe(true);
  });

  it("expands mixed seed bag sizes into variable-width slots", () => {
    const config = normalizeRackConfig({
      rackLengthMm: 1800,
      rackHeightMm: 2000,
      rackLevels: 4,
      defaultGapMm: 10,
      sides: [
        {
          side: "left",
          levels: [
            {
              level: 1,
              items: [
                { id: "a", specId: 1, quantity: 2 },
                { id: "b", specId: 3, quantity: 1 },
              ],
            },
          ],
        },
      ],
    });

    const slots = expandRackLevelItems(config, "left", 1);

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.widthMm)).toEqual([80, 80, 158]);
    expect(slots.map((slot) => slot.xStartMm)).toEqual([0, 90, 180]);
    expect(slots[2].xCenterMm).toBe(259);
  });

  it("reports rows that exceed the 1800mm rack length", () => {
    const config = createDefaultRackConfig();
    const level = config.sides[0].levels[0];
    level.items = [{ id: "oversize", specId: 3, quantity: 20 }];
    const layout = getRackLevelLayouts(config).find((entry) => entry.side === "left" && entry.level === 1);

    expect(layout?.overflowMm).toBeGreaterThan(0);
    expect(() => assertValidRackConfig(config)).toThrow(RackConfigValidationError);
  });

  it("reads defaults and writes normalized config through the JSON file adapter", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stacker-rack-config-"));
    process.env.RACK_CONFIG_PATH = path.join(tempDir, "rack-config.json");

    const initial = readRackConfigFormValue();
    expect(initial.exists).toBe(false);
    expect(initial.value.rackLengthMm).toBe(1800);

    const saved = writeRackConfigFormValue(initial.value);
    const reloaded = readRackConfigFormValue();

    expect(saved.exists).toBe(true);
    expect(reloaded.exists).toBe(true);
    expect(reloaded.value).toEqual(saved.value);
  });
});
