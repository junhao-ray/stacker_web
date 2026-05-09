import { OUTBOUND_TASKS, SEED_PRODUCTS } from "./mock-data";
import {
  applyRackSlotIdentity,
  cloneRackConfig,
  createDefaultRackConfig,
  expandRackLevelItems,
  toTwinConfig,
} from "./rack-config";
import type {
  OutboundTask,
  TwinConfig,
  TwinDataSource,
  TwinLogEntry,
  TwinPickStep,
  TwinQueueTask,
  TwinRackConfig,
  TwinRackSlot,
  TwinRobotState,
  TwinSide,
  TwinSnapshot,
  TwinTransferBinEntry,
} from "./types";

const DEFAULT_RACK_CONFIG = createDefaultRackConfig();
const SIDES: TwinSide[] = ["left", "right"];

function getRackConfig(rackConfig?: TwinRackConfig) {
  return rackConfig ? cloneRackConfig(rackConfig) : cloneRackConfig(DEFAULT_RACK_CONFIG);
}

function buildRackSlots(rackConfig?: TwinRackConfig): TwinRackSlot[] {
  const config = getRackConfig(rackConfig);
  const slots: TwinRackSlot[] = [];
  const productIndexBySpec = new Map<number, number>();
  const fallbackProducts = SEED_PRODUCTS.length > 0 ? SEED_PRODUCTS : [{
    code: "INV000",
    name: "Seed bag",
    category: "Seed",
    specId: 1,
    stock: 12,
    location: "A-01-01",
    status: "normal" as const,
  }];

  for (const side of SIDES) {
    for (let level = 1; level <= config.rackLevels; level += 1) {
      const levelSlots = expandRackLevelItems(config, side, level);

      for (const levelSlot of levelSlots) {
        const candidates = SEED_PRODUCTS.filter((product) => product.specId === levelSlot.specId);
        const productPool = candidates.length > 0 ? candidates : fallbackProducts;
        const productIndex = productIndexBySpec.get(levelSlot.specId) ?? 0;
        const product = productPool[productIndex % productPool.length];
        productIndexBySpec.set(levelSlot.specId, productIndex + 1);
        slots.push(applyRackSlotIdentity(levelSlot, product));
      }
    }
  }

  return slots;
}

function buildSlotMap(slots: TwinRackSlot[]) {
  const slotByProduct = new Map<string, TwinRackSlot[]>();

  for (const slot of slots) {
    const bucket = slotByProduct.get(slot.productCode) ?? [];
    bucket.push(slot);
    slotByProduct.set(slot.productCode, bucket);
  }

  return slotByProduct;
}

function buildPickSteps(
  item: OutboundTask["items"][number],
  taskNo: string,
  index: number,
  slots: TwinRackSlot[],
  slotByProduct: Map<string, TwinRackSlot[]>,
): TwinPickStep[] {
  const matchingSlots = slotByProduct.get(item.productCode) ?? [];
  const specSlots = slots.filter((slot) => slot.specId === item.specId);
  const fallbackSlot =
    matchingSlots[0] ??
    specSlots[0] ??
    slots[(index + taskNo.length) % Math.max(1, slots.length)];

  if (!fallbackSlot) return [];

  const preferredSlot =
    matchingSlots.find((slot) => slot.stockQty >= item.quantity) ??
    matchingSlots[0] ??
    specSlots.find((slot) => slot.stockQty >= item.quantity) ??
    specSlots[0] ??
    fallbackSlot;

  return Array.from({ length: item.quantity }, (_, packageIndex) => ({
    id: `${taskNo}-${item.productCode}-${index + 1}-${packageIndex + 1}`,
    taskNo,
    productCode: item.productCode,
    productName: item.productName,
    quantity: 1,
    slotId: preferredSlot.id,
    side: preferredSlot.side,
    column: preferredSlot.column,
    level: preferredSlot.level,
    status: "pending",
  }));
}

function toQueueTask(
  task: OutboundTask,
  slots: TwinRackSlot[],
  slotByProduct: Map<string, TwinRackSlot[]>,
): TwinQueueTask {
  const steps = task.items.flatMap((item, index) => buildPickSteps(item, task.taskNo, index, slots, slotByProduct));
  const isCompleted = task.status === "completed";

  return {
    taskNo: task.taskNo,
    orderNo: task.orderNo,
    status: task.status,
    createdAt: task.createdAt,
    operator: task.operator,
    stepCount: steps.length,
    totalQuantity: steps.length,
    completedSteps: isCompleted ? steps.length : 0,
    steps: steps.map((step) => ({
      ...step,
      status: isCompleted ? "completed" : "pending",
    })),
  };
}

function buildTwinQueue(slots: TwinRackSlot[]) {
  const slotByProduct = buildSlotMap(slots);

  return OUTBOUND_TASKS.filter(
    (task) => task.status === "pending" || task.status === "picking" || task.status === "completed",
  ).map((task) => toQueueTask(task, slots, slotByProduct));
}

function getDefaultActiveTask(queue: TwinQueueTask[]) {
  return queue.find((task) => task.status === "picking") ??
    queue.find((task) => task.status === "pending") ??
    null;
}

function buildInitialRobot(activeTask: TwinQueueTask | null, slots: TwinRackSlot[]): TwinRobotState {
  const firstSlot = slots[0];

  return {
    xColumn: activeTask?.steps[0]?.column ?? firstSlot?.column ?? 1,
    zLevel: activeTask?.steps[0]?.level ?? firstSlot?.level ?? 1,
    facingSide: activeTask?.steps[0]?.side ?? firstSlot?.side ?? "right",
    phase: "idle",
    cylinderExtended: false,
    vacuumOn: false,
    activeSlotId: activeTask?.steps[0]?.slotId ?? firstSlot?.id ?? null,
    activeTaskNo: activeTask?.taskNo ?? null,
  };
}

function buildInitialLogs(activeTask: TwinQueueTask | null): TwinLogEntry[] {
  const logs: TwinLogEntry[] = [
    {
      id: "system-ready",
      timestamp: "08:00:00",
      level: "success",
      message: "数字孪生场景已就绪，等待任务开始。",
    },
  ];

  if (activeTask) {
    const firstStep = activeTask.steps[0];
    logs.unshift({
      id: `focus-${activeTask.taskNo}`,
      timestamp: "08:00:00",
      level: "info",
      message: `已聚焦任务 ${activeTask.taskNo}，目标 ${sideLabel(firstStep.side)}侧 ${firstStep.column} 列 ${firstStep.level} 层。`,
    });
  }

  return logs;
}

function sideLabel(side: TwinSide) {
  return side === "left" ? "上" : "下";
}

export function getTwinConfig(rackConfig?: TwinRackConfig): TwinConfig {
  return toTwinConfig(getRackConfig(rackConfig));
}

export function getTwinRackSlots(rackConfig?: TwinRackConfig) {
  return buildRackSlots(rackConfig).map((slot) => ({ ...slot }));
}

export function getTwinQueueData(rackConfig?: TwinRackConfig) {
  const slots = buildRackSlots(rackConfig);
  return buildTwinQueue(slots).map((task) => ({
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  }));
}

export function getTwinTaskData(taskNo: string, rackConfig?: TwinRackConfig) {
  const task = getTwinQueueData(rackConfig).find((entry) => entry.taskNo === taskNo);
  if (!task) return null;

  return {
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  };
}

export function buildTwinSnapshot(rackConfig?: TwinRackConfig): TwinSnapshot {
  const config = getRackConfig(rackConfig);
  const slots = getTwinRackSlots(config);
  const queue = buildTwinQueue(slots);
  const activeTask = getDefaultActiveTask(queue);
  const transferBin: TwinTransferBinEntry[] = [];

  return {
    config: getTwinConfig(config),
    robot: buildInitialRobot(activeTask, slots),
    slots: slots.map((slot) => ({ ...slot })),
    queue: queue.map((task) => ({
      ...task,
      steps: task.steps.map((step) => ({ ...step })),
    })),
    activeTask: activeTask ? {
      ...activeTask,
      steps: activeTask.steps.map((step) => ({ ...step })),
    } : null,
    transferBin,
    logs: buildInitialLogs(activeTask),
  };
}

export const mockTwinDataSource: TwinDataSource & {
  getTwinSnapshot(rackConfig?: TwinRackConfig): Promise<TwinSnapshot>;
} = {
  async getTwinSnapshot(rackConfig?: TwinRackConfig) {
    return buildTwinSnapshot(rackConfig);
  },
  async getTwinQueue() {
    return getTwinQueueData();
  },
  async getTwinTask(taskNo: string) {
    return getTwinTaskData(taskNo);
  },
};
