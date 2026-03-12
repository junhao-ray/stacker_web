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
