import { OUTBOUND_TASKS, SEED_PRODUCTS } from "./mock-data";
import type {
  OutboundTask,
  TwinConfig,
  TwinDataSource,
  TwinLogEntry,
  TwinPickStep,
  TwinQueueTask,
  TwinRackSlot,
  TwinRobotState,
  TwinSide,
  TwinSnapshot,
  TwinTransferBinEntry,
} from "./types";

const TWIN_CONFIG: TwinConfig = {
  xAxisMeters: 5,
  zAxisMeters: 2,
  rackColumns: 30,
  rackLevels: 8,
  columnPitchMeters: 5 / 30,
  levelHeightMeters: 0.25,
};

const COLUMNS = Array.from({ length: TWIN_CONFIG.rackColumns }, (_, index) => index + 1);
const LEVELS = Array.from({ length: TWIN_CONFIG.rackLevels }, (_, index) => index + 1);
const SIDES: TwinSide[] = ["left", "right"];

function buildSlotProductPool() {
  const productByCode = new Map(SEED_PRODUCTS.map((product) => [product.code, product]));
  const taskProducts = OUTBOUND_TASKS.flatMap((task) => task.items)
    .map((item) => productByCode.get(item.productCode))
    .filter((product): product is typeof SEED_PRODUCTS[number] => Boolean(product));
  const uniqueTaskProducts = Array.from(
    new Map(taskProducts.map((product) => [product.code, product])).values(),
  );
  const fallbackProducts = SEED_PRODUCTS.filter(
    (product) => !uniqueTaskProducts.some((entry) => entry.code === product.code),
  );
  const pool = [...uniqueTaskProducts, ...fallbackProducts];
  const required = SIDES.length * TWIN_CONFIG.rackColumns * TWIN_CONFIG.rackLevels;

  while (pool.length < required) {
    pool.push(...SEED_PRODUCTS);
  }

  return pool.slice(0, required);
}

function buildRackSlots(): TwinRackSlot[] {
  const products = buildSlotProductPool();
  const slots: TwinRackSlot[] = [];
  let productIndex = 0;

  for (const side of SIDES) {
    for (const column of COLUMNS) {
      for (const level of LEVELS) {
        const product = products[productIndex++];
        const stockQty = Math.max(product.stock, 12);
        const status = stockQty === 0 ? "empty" : stockQty < 30 ? "low" : "ready";

        slots.push({
          id: `${side}-${String(column).padStart(2, "0")}-${String(level).padStart(2, "0")}`,
          side,
          column,
          level,
          productCode: product.code,
          productName: product.name,
          stockQty,
          status,
        });
      }
    }
  }

  return slots;
}

const RACK_SLOTS = buildRackSlots();
const SLOT_BY_PRODUCT = new Map<string, TwinRackSlot[]>();

for (const slot of RACK_SLOTS) {
  const bucket = SLOT_BY_PRODUCT.get(slot.productCode) ?? [];
  bucket.push(slot);
  SLOT_BY_PRODUCT.set(slot.productCode, bucket);
}

function buildPickSteps(item: OutboundTask["items"][number], taskNo: string, index: number): TwinPickStep[] {
  const matchingSlots = SLOT_BY_PRODUCT.get(item.productCode) ?? [];
  const fallbackSlot = RACK_SLOTS[(index + taskNo.length) % RACK_SLOTS.length];
  const preferredSlot =
    matchingSlots.find((slot) => slot.stockQty >= item.quantity) ??
    matchingSlots[0] ??
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

function toQueueTask(task: OutboundTask): TwinQueueTask {
  const steps = task.items.flatMap((item, index) => buildPickSteps(item, task.taskNo, index));
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

const TWIN_QUEUE = OUTBOUND_TASKS.filter(
  (task) => task.status === "pending" || task.status === "picking" || task.status === "completed",
).map(toQueueTask);

function getDefaultActiveTask() {
  return TWIN_QUEUE.find((task) => task.status === "picking") ??
    TWIN_QUEUE.find((task) => task.status === "pending") ??
    null;
}

function buildInitialRobot(activeTask: TwinQueueTask | null): TwinRobotState {
  return {
    xColumn: activeTask?.steps[0]?.column ?? 15,
    zLevel: activeTask?.steps[0]?.level ?? 4,
    facingSide: activeTask?.steps[0]?.side ?? "right",
    phase: "idle",
    cylinderExtended: false,
    vacuumOn: false,
    activeSlotId: activeTask?.steps[0]?.slotId ?? null,
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

export function getTwinConfig() {
  return TWIN_CONFIG;
}

export function getTwinRackSlots() {
  return RACK_SLOTS.map((slot) => ({ ...slot }));
}

export function getTwinQueueData() {
  return TWIN_QUEUE.map((task) => ({
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  }));
}

export function getTwinTaskData(taskNo: string) {
  const task = TWIN_QUEUE.find((entry) => entry.taskNo === taskNo);
  if (!task) return null;

  return {
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  };
}

export function buildTwinSnapshot(): TwinSnapshot {
  const activeTask = getDefaultActiveTask();
  const transferBin: TwinTransferBinEntry[] = [];

  return {
    config: getTwinConfig(),
    robot: buildInitialRobot(activeTask),
    slots: getTwinRackSlots(),
    queue: getTwinQueueData(),
    activeTask: activeTask ? getTwinTaskData(activeTask.taskNo) : null,
    transferBin,
    logs: buildInitialLogs(activeTask),
  };
}

export const mockTwinDataSource: TwinDataSource = {
  async getTwinSnapshot() {
    return buildTwinSnapshot();
  },
  async getTwinQueue() {
    return getTwinQueueData();
  },
  async getTwinTask(taskNo: string) {
    return getTwinTaskData(taskNo);
  },
};
