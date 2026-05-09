import { SEED_SPECS } from "@/lib/mock-data";
import type {
  TwinRackConfig,
  TwinRackLevelConfig,
  TwinRackLevelItemConfig,
  TwinRackLevelLayout,
  TwinRackSideConfig,
  TwinRackSlot,
  TwinSide,
} from "@/lib/types";

export const RACK_SIDES: TwinSide[] = ["left", "right"];
export const DEFAULT_RACK_LENGTH_MM = 1800;
export const DEFAULT_RACK_HEIGHT_MM = 2000;
export const DEFAULT_RACK_LEVELS = 4;
export const DEFAULT_RACK_GAP_MM = 10;

const DEFAULT_LEVEL_SPEC_IDS: Record<TwinSide, number[][]> = {
  left: [
    [1, 2, 4],
    [3, 6, 1],
    [5, 8, 10],
    [7, 9, 2],
  ],
  right: [
    [4, 5, 1],
    [6, 3, 8],
    [2, 10, 7],
    [9, 1, 5],
  ],
};

export class RackConfigValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "RackConfigValidationError";
    this.errors = errors;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function makeItemId(side: TwinSide, level: number, index: number) {
  return `${side}-${String(level).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
}

function getSpecWidth(specId: number) {
  return SEED_SPECS.find((spec) => spec.id === specId)?.width ?? SEED_SPECS[0]?.width ?? 80;
}

function createDefaultLevel(side: TwinSide, level: number): TwinRackLevelConfig {
  const specIds = DEFAULT_LEVEL_SPEC_IDS[side][level - 1] ?? [1, 2, 3];
  const items: TwinRackLevelItemConfig[] = [];
  let remaining = DEFAULT_RACK_LENGTH_MM;

  specIds.forEach((specId, index) => {
    const width = getSpecWidth(specId);
    const gap = index === specIds.length - 1 ? 0 : DEFAULT_RACK_GAP_MM;
    const targetQuantity = level % 2 === 1
      ? (index === 0 ? 7 : index === 1 ? 4 : 3)
      : (index === 0 ? 5 : 3);
    const maxQuantity = Math.max(1, Math.floor((remaining + gap) / (width + gap)));
    const quantity = Math.max(1, Math.min(targetQuantity, maxQuantity));
    items.push({
      id: makeItemId(side, level, index),
      specId,
      quantity,
      ...(gap === DEFAULT_RACK_GAP_MM ? {} : { gapAfterMm: gap }),
    });
    remaining -= quantity * width + Math.max(0, quantity - 1) * DEFAULT_RACK_GAP_MM;
    if (index < specIds.length - 1) remaining -= DEFAULT_RACK_GAP_MM;
  });

  return { level, items };
}

export function createDefaultRackConfig(): TwinRackConfig {
  return {
    rackLengthMm: DEFAULT_RACK_LENGTH_MM,
    rackHeightMm: DEFAULT_RACK_HEIGHT_MM,
    rackLevels: DEFAULT_RACK_LEVELS,
    defaultGapMm: DEFAULT_RACK_GAP_MM,
    sides: RACK_SIDES.map((side): TwinRackSideConfig => ({
      side,
      levels: Array.from({ length: DEFAULT_RACK_LEVELS }, (_, index) => createDefaultLevel(side, index + 1)),
    })),
  };
}

export function cloneRackConfig(config: TwinRackConfig): TwinRackConfig {
  return {
    ...config,
    sides: config.sides.map((side) => ({
      ...side,
      levels: side.levels.map((level) => ({
        ...level,
        items: level.items.map((item) => ({ ...item })),
      })),
    })),
  };
}

function normalizeItem(raw: unknown, side: TwinSide, level: number, index: number): TwinRackLevelItemConfig {
  const defaults = createDefaultLevel(side, level).items[index] ?? createDefaultLevel(side, level).items[0];
  const item = isObject(raw) ? raw : {};
  const specId = clampInteger(item.specId, defaults.specId, 1, Math.max(1, SEED_SPECS.length));
  const quantity = clampInteger(item.quantity, defaults.quantity, 1, 200);
  const rawGap = readNumber(item.gapAfterMm, Number.NaN);
  const gapAfterMm = Number.isFinite(rawGap) ? Math.max(0, Math.round(rawGap)) : undefined;

  return {
    id: readString(item.id, makeItemId(side, level, index)),
    specId,
    quantity,
    ...(typeof gapAfterMm === "number" ? { gapAfterMm } : {}),
  };
}

function normalizeLevel(raw: unknown, side: TwinSide, level: number): TwinRackLevelConfig {
  const source = isObject(raw) ? raw : {};
  const rawItems = Array.isArray(source.items) ? source.items : createDefaultLevel(side, level).items;
  const items = rawItems.length > 0
    ? rawItems.map((item, index) => normalizeItem(item, side, level, index))
    : createDefaultLevel(side, level).items;

  return {
    level,
    items,
  };
}

function normalizeSide(raw: unknown, side: TwinSide, rackLevels: number): TwinRackSideConfig {
  const source = isObject(raw) ? raw : {};
  const rawLevels = Array.isArray(source.levels) ? source.levels : [];

  return {
    side,
    levels: Array.from({ length: rackLevels }, (_, index) => {
      const level = index + 1;
      const found = rawLevels.find((entry) => isObject(entry) && Number(entry.level) === level);
      return normalizeLevel(found, side, level);
    }),
  };
}

export function normalizeRackConfig(raw: unknown): TwinRackConfig {
  const defaults = createDefaultRackConfig();
  const source = isObject(raw) ? raw : {};
  const rackLevels = clampInteger(source.rackLevels, defaults.rackLevels, 1, 12);
  const rawSides = Array.isArray(source.sides) ? source.sides : [];

  return {
    rackLengthMm: Math.max(300, Math.round(readNumber(source.rackLengthMm, defaults.rackLengthMm))),
    rackHeightMm: Math.max(300, Math.round(readNumber(source.rackHeightMm, defaults.rackHeightMm))),
    rackLevels,
    defaultGapMm: Math.max(0, Math.round(readNumber(source.defaultGapMm, defaults.defaultGapMm))),
    sides: RACK_SIDES.map((side) => {
      const found = rawSides.find((entry) => isObject(entry) && entry.side === side);
      return normalizeSide(found, side, rackLevels);
    }),
  };
}

export function expandRackLevelItems(config: TwinRackConfig, side: TwinSide, level: number) {
  const sideConfig = config.sides.find((entry) => entry.side === side);
  const levelConfig = sideConfig?.levels.find((entry) => entry.level === level);
  if (!levelConfig) return [];

  let xStartMm = 0;
  const slots: Array<{
    side: TwinSide;
    level: number;
    column: number;
    specId: number;
    xStartMm: number;
    widthMm: number;
    xCenterMm: number;
  }> = [];

  levelConfig.items.forEach((item, itemIndex) => {
    const widthMm = getSpecWidth(item.specId);
    const gapMm = item.gapAfterMm ?? config.defaultGapMm;
    const hasMoreItems = itemIndex < levelConfig.items.length - 1;

    for (let index = 0; index < item.quantity; index += 1) {
      slots.push({
        side,
        level,
        column: slots.length + 1,
        specId: item.specId,
        xStartMm,
        widthMm,
        xCenterMm: xStartMm + widthMm / 2,
      });
      xStartMm += widthMm;
      if (index < item.quantity - 1 || hasMoreItems) {
        xStartMm += gapMm;
      }
    }
  });

  return slots;
}

export function getRackLevelLayouts(config: TwinRackConfig): TwinRackLevelLayout[] {
  return config.sides.flatMap((side) => (
    side.levels.map((level) => {
      const slots = expandRackLevelItems(config, side.side, level.level);
      const lastSlot = slots.at(-1);
      const usedLengthMm = lastSlot ? lastSlot.xStartMm + lastSlot.widthMm : 0;
      const remainingLengthMm = Math.max(0, config.rackLengthMm - usedLengthMm);
      const overflowMm = Math.max(0, usedLengthMm - config.rackLengthMm);

      return {
        side: side.side,
        level: level.level,
        slotCount: slots.length,
        usedLengthMm,
        remainingLengthMm,
        overflowMm,
      };
    })
  ));
}

export function validateRackConfig(config: TwinRackConfig) {
  const errors: string[] = [];

  if (config.rackLengthMm !== DEFAULT_RACK_LENGTH_MM) {
    errors.push("Rack length must be 1800mm for the current machine.");
  }
  if (config.rackHeightMm !== DEFAULT_RACK_HEIGHT_MM) {
    errors.push("Rack height must be 2000mm for the current machine.");
  }
  if (config.rackLevels !== DEFAULT_RACK_LEVELS) {
    errors.push("Rack level count must be 4 for the current machine.");
  }

  getRackLevelLayouts(config).forEach((layout) => {
    if (layout.slotCount <= 0) {
      errors.push(`${layout.side} level ${layout.level} must contain at least one seed bag.`);
    }
    if (layout.overflowMm > 0) {
      errors.push(`${layout.side} level ${layout.level} exceeds rack length by ${layout.overflowMm}mm.`);
    }
  });

  return errors;
}

export function assertValidRackConfig(config: TwinRackConfig) {
  const errors = validateRackConfig(config);
  if (errors.length > 0) {
    throw new RackConfigValidationError(errors);
  }
}

export function getMaxRackColumnsFromConfig(config: TwinRackConfig) {
  return Math.max(1, ...getRackLevelLayouts(config).map((layout) => layout.slotCount));
}

export function toTwinConfig(config: TwinRackConfig) {
  const rackColumns = getMaxRackColumnsFromConfig(config);

  return {
    xAxisMeters: config.rackLengthMm / 1000,
    zAxisMeters: config.rackHeightMm / 1000,
    rackColumns,
    rackLevels: config.rackLevels,
    columnPitchMeters: rackColumns > 0 ? config.rackLengthMm / 1000 / rackColumns : 0,
    levelHeightMeters: config.rackHeightMm / 1000 / config.rackLevels,
    rackLengthMm: config.rackLengthMm,
    rackHeightMm: config.rackHeightMm,
    defaultGapMm: config.defaultGapMm,
  };
}

export function applyRackSlotIdentity(
  slot: ReturnType<typeof expandRackLevelItems>[number],
  product: { code: string; name: string; stock: number },
): TwinRackSlot {
  const stockQty = Math.max(product.stock, 12);

  return {
    id: `${slot.side}-${String(slot.level).padStart(2, "0")}-${String(slot.column).padStart(2, "0")}`,
    side: slot.side,
    column: slot.column,
    level: slot.level,
    specId: slot.specId,
    xStartMm: slot.xStartMm,
    widthMm: slot.widthMm,
    xCenterMm: slot.xCenterMm,
    productCode: product.code,
    productName: product.name,
    stockQty,
    status: stockQty === 0 ? "empty" : stockQty < 30 ? "low" : "ready",
  };
}
