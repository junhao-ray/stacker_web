// ─── 包装规格 ─────────────────────────────────────────────────────────────────

export interface SeedSpec {
  id: number;
  /** 薄度 (cm) */
  thinness: string;
  /** 厚度 (cm) */
  thickness: number;
  /** 宽度 (cm) */
  width: number;
  /** 长度 (cm) */
  length: number;
  /** 包装类型：罐装 | 袋装 */
  packType: "罐装" | "袋装";
}

// ─── 种子品种 ─────────────────────────────────────────────────────────────────

export interface SeedProduct {
  /** 种子编码 */
  code: string;
  /** 品种名称 */
  name: string;
  /** 种子类型 */
  category: string;
  /** 关联规格 ID (1-16) */
  specId: number;
  /** 当前库存 */
  stock: number;
  /** 库位号 e.g. "A-03-12" */
  location: string;
  /** 库存状态 */
  status: "normal" | "low" | "empty";
}

// ─── 出库任务 ─────────────────────────────────────────────────────────────────

export type OutboundStatus = "pending" | "picking" | "completed" | "cancelled";

export interface OutboundItem {
  /** 种子编码 */
  productCode: string;
  /** 品种名称 */
  productName: string;
  /** 规格 ID */
  specId: number;
  /** 数量 */
  quantity: number;
}

export interface OutboundTask {
  /** 任务编号 e.g. "CK20260312001" */
  taskNo: string;
  /** 关联订单号 */
  orderNo: string;
  /** 出库种子明细 */
  items: OutboundItem[];
  /** 任务状态 */
  status: OutboundStatus;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间 */
  completedAt?: string;
  /** 操作员 */
  operator?: string;
}

// ─── 仪表盘统计 ───────────────────────────────────────────────────────────────

export interface WarehouseStats {
  /** 种子品种总数 */
  totalProducts: number;
  /** 库存总量（袋/罐） */
  totalStock: number;
  /** 待出库任务数 */
  pendingTasks: number;
  /** 今日已出库数 */
  todayCompleted: number;
  /** 包装规格数 */
  specCount: number;
  /** 低库存预警数 */
  lowStockCount: number;
}

// ─── 数字孪生 ───────────────────────────────────────────────────────────────

export type TwinSide = "left" | "right";

export type TwinMachinePhase =
  | "idle"
  | "moving"
  | "rotating"
  | "extending"
  | "suction"
  | "retracting"
  | "dropping"
  | "paused"
  | "completed"
  | "alarm";

export type TwinQueueTaskStatus = "pending" | "picking" | "completed" | "cancelled";

export type TwinPickStepStatus = "pending" | "active" | "completed" | "error";

export type TwinSlotStatus = "ready" | "low" | "empty";

export interface TwinConfig {
  xAxisMeters: number;
  zAxisMeters: number;
  rackColumns: number;
  rackLevels: number;
  columnPitchMeters: number;
  levelHeightMeters: number;
}

export interface TwinRackSlot {
  id: string;
  side: TwinSide;
  column: number;
  level: number;
  productCode: string;
  productName: string;
  stockQty: number;
  status: TwinSlotStatus;
}

export interface TwinRobotState {
  xColumn: number;
  zLevel: number;
  facingSide: TwinSide;
  phase: TwinMachinePhase;
  cylinderExtended: boolean;
  vacuumOn: boolean;
  activeSlotId: string | null;
  activeTaskNo: string | null;
}

export interface TwinPickStep {
  id: string;
  taskNo: string;
  productCode: string;
  productName: string;
  quantity: number;
  slotId: string;
  side: TwinSide;
  column: number;
  level: number;
  status: TwinPickStepStatus;
}

export interface TwinQueueTask {
  taskNo: string;
  orderNo: string;
  status: TwinQueueTaskStatus;
  createdAt: string;
  operator?: string;
  stepCount: number;
  totalQuantity: number;
  completedSteps: number;
  steps: TwinPickStep[];
}

export interface TwinTransferBinEntry {
  productCode: string;
  productName: string;
  quantity: number;
  pickedAt: string;
}

export interface TwinLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface TwinSnapshot {
  config: TwinConfig;
  robot: TwinRobotState;
  slots: TwinRackSlot[];
  queue: TwinQueueTask[];
  activeTask: TwinQueueTask | null;
  transferBin: TwinTransferBinEntry[];
  logs: TwinLogEntry[];
}

export interface TwinDataSource {
  getTwinSnapshot(): Promise<TwinSnapshot>;
  getTwinQueue(): Promise<TwinQueueTask[]>;
  getTwinTask(taskNo: string): Promise<TwinQueueTask | null>;
}

// ─── PLC / OPC UA 控制 ───────────────────────────────────────────────────────

export type PlcMode = "simulation" | "plc";

export type PlcMachineState = "idle" | "running" | "paused" | "alarm" | "unknown";

export type PlcCommand = "dispatchTask" | "start" | "pause" | "resume" | "reset";

export type PlcCommandResult =
  | "ok"
  | "rejected"
  | "timeout"
  | "transport_error";

export interface DispatchTaskStep {
  index: number;
  productCode: string;
  quantity: number;
  side: TwinSide;
  column: number;
  level: number;
  slotId: string;
}

export interface DispatchTaskPayload {
  taskNo: string;
  orderNo: string;
  stepCount: number;
  steps: DispatchTaskStep[];
}

export interface PlcCommandRequest {
  command: PlcCommand;
  task?: DispatchTaskPayload;
}

export interface PlcLastCommand {
  command: PlcCommand;
  taskNo: string | null;
  result: PlcCommandResult;
  requestId: string;
  errorCode?: string;
  errorMessage?: string;
  acknowledgedAt?: string;
}

export interface PlcStatusSnapshot {
  configured: boolean;
  connected: boolean;
  machineState: PlcMachineState;
  currentTaskNo: string | null;
  commandInFlight: boolean;
  lastCommand: PlcLastCommand | null;
  updatedAt: string;
}
