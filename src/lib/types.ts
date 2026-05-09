// ─── 库存类型 / 外形尺寸 ─────────────────────────────────────────────────────

export interface SeedSpec {
  id: number;
  /** 库存类型名称 */
  name: string;
  /** 薄度（保留字段） */
  thinness: string;
  /** 厚度（保留字段） */
  thickness: number;
  /** 宽度 (mm) */
  width: number;
  /** 高度 (mm) */
  length: number;
  /** 包装类型：罐装 | 袋装 */
  packType: "罐装" | "袋装";
}

// ─── 库存记录 ─────────────────────────────────────────────────────────────────

export interface SeedProduct {
  /** 库存编码 */
  code: string;
  /** 库存类型名称 */
  name: string;
  /** 库存分类 */
  category: string;
  /** 关联库存类型 ID */
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
  /** 库存编码 */
  productCode: string;
  /** 库存类型名称 */
  productName: string;
  /** 库存类型 ID */
  specId: number;
  /** 数量 */
  quantity: number;
}

export interface OutboundTask {
  /** 任务编号 e.g. "CK20260312001" */
  taskNo: string;
  /** 关联订单号 */
  orderNo: string;
  /** 出库库存明细 */
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
  /** 库存类型总数 */
  totalProducts: number;
  /** 库存总量（袋/罐） */
  totalStock: number;
  /** 待出库任务数 */
  pendingTasks: number;
  /** 今日已出库数 */
  todayCompleted: number;
  /** 库存类型数 */
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
  | "releasing"
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
  rackLengthMm: number;
  rackHeightMm: number;
  defaultGapMm: number;
}

export interface TwinRackLevelItemConfig {
  id: string;
  specId: number;
  quantity: number;
  gapAfterMm?: number;
}

export interface TwinRackLevelConfig {
  level: number;
  items: TwinRackLevelItemConfig[];
}

export interface TwinRackSideConfig {
  side: TwinSide;
  levels: TwinRackLevelConfig[];
}

export interface TwinRackConfig {
  rackLengthMm: number;
  rackHeightMm: number;
  rackLevels: number;
  defaultGapMm: number;
  sides: TwinRackSideConfig[];
}

export interface TwinRackLevelLayout {
  side: TwinSide;
  level: number;
  slotCount: number;
  usedLengthMm: number;
  remainingLengthMm: number;
  overflowMm: number;
}

export interface TwinRackSlot {
  id: string;
  side: TwinSide;
  column: number;
  level: number;
  specId: number;
  xStartMm: number;
  widthMm: number;
  xCenterMm: number;
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

export type PlcCommand = "pickToBin" | "releaseBin" | "pause" | "resume" | "home" | "resetAlarm";

export type PlcCommandResult =
  | "ok"
  | "busy"
  | "alarm"
  | "invalid_target"
  | "rejected"
  | "timeout"
  | "transport_error";

export interface PlcPickToBinPayload {
  taskNo: string;
  orderNo: string;
  stepId: string;
  productCode: string;
  slotId: string;
  targetX: number;
  targetY: number;
  targetSide: number;
  targetQty: number;
}

export interface PlcCommandRequest {
  command: PlcCommand;
  payload?: PlcPickToBinPayload;
}

export interface PlcLastCommand {
  command: PlcCommand;
  taskNo: string | null;
  stepId?: string | null;
  result: PlcCommandResult;
  requestId: string;
  errorCode?: string;
  errorMessage?: string;
  acknowledgedAt?: string;
  completedAt?: string;
}

export interface PlcStatusSnapshot {
  configured: boolean;
  connected: boolean;
  machineState: PlcMachineState;
  currentTaskNo: string | null;
  currentSeq: number | null;
  currentStepId: string | null;
  stepBusy: boolean;
  stepDone: boolean;
  actualX: number | null;
  actualY: number | null;
  alarm: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  commandInFlight: boolean;
  lastCommand: PlcLastCommand | null;
  updatedAt: string;
}
