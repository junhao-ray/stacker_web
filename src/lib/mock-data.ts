import type {
  SeedSpec,
  SeedProduct,
  OutboundTask,
  OutboundStatus,
  WarehouseStats,
} from "./types";

// ─── 10 种库存类型（来自用户提供的库存尺寸表） ───────────────────────────────

export const SEED_SPECS: SeedSpec[] = [
  { id: 1,  name: "红菊苣",       thinness: "", thickness: 0, width: 80,  length: 123, packType: "袋装" },
  { id: 2,  name: "矮生野花组合", thinness: "", thickness: 0, width: 92,  length: 143, packType: "袋装" },
  { id: 3,  name: "矮大头油葵",   thinness: "", thickness: 0, width: 158, length: 236, packType: "袋装" },
  { id: 4,  name: "京秋4号",      thinness: "", thickness: 0, width: 108, length: 173, packType: "袋装" },
  { id: 5,  name: "京春娃4号",    thinness: "", thickness: 0, width: 99,  length: 159, packType: "袋装" },
  { id: 6,  name: "BM30",         thinness: "", thickness: 0, width: 148, length: 211, packType: "袋装" },
  { id: 7,  name: "京春黄3号",    thinness: "", thickness: 0, width: 110, length: 174, packType: "袋装" },
  { id: 8,  name: "丰芸天下",     thinness: "", thickness: 0, width: 117, length: 173, packType: "袋装" },
  { id: 9,  name: "京美10K02",    thinness: "", thickness: 0, width: 109, length: 173, packType: "袋装" },
  { id: 10, name: "京春黄2号",    thinness: "", thickness: 0, width: 99,  length: 159, packType: "袋装" },
];

// ─── Mock 库存品种 ───────────────────────────────────────────────────────────

const STOCK_BY_SPEC_ID: Record<number, number> = {
  1: 126,
  2: 84,
  3: 36,
  4: 118,
  5: 26,
  6: 64,
  7: 91,
  8: 73,
  9: 49,
  10: 18,
};

const CATEGORY_BY_SPEC_ID: Record<number, string> = {
  1: "菊苣",
  2: "野花组合",
  3: "油葵",
  4: "京秋系列",
  5: "京春系列",
  6: "BM系列",
  7: "京春系列",
  8: "丰芸系列",
  9: "京美系列",
  10: "京春系列",
};

const LOCATION_BY_SPEC_ID: Record<number, string> = {
  1: "A-01-01",
  2: "A-01-02",
  3: "A-02-01",
  4: "B-01-01",
  5: "B-01-02",
  6: "B-02-01",
  7: "C-01-01",
  8: "C-01-02",
  9: "C-02-01",
  10: "C-02-02",
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateProducts(): SeedProduct[] {
  return SEED_SPECS.map((spec): SeedProduct => {
    const stock = STOCK_BY_SPEC_ID[spec.id] ?? 0;

    return {
      code: `INV${String(spec.id).padStart(3, "0")}`,
      name: spec.name,
      category: CATEGORY_BY_SPEC_ID[spec.id] ?? "库存类型",
      specId: spec.id,
      stock,
      location: LOCATION_BY_SPEC_ID[spec.id] ?? "A-01-01",
      status: stock === 0 ? "empty" : stock < 30 ? "low" : "normal",
    };
  });
}

export const SEED_PRODUCTS: SeedProduct[] = generateProducts();

// ─── Mock 出库任务 ───────────────────────────────────────────────────────────

function generateTasks(): OutboundTask[] {
  const rand = seededRandom(123);
  const statuses: OutboundStatus[] = ["pending", "picking", "completed", "cancelled"];
  const operators = ["张三", "李四", "王五", "赵六", "钱七"];
  const tasks: OutboundTask[] = [];

  for (let i = 0; i < 35; i++) {
    const numItems = Math.floor(rand() * 4) + 1;
    const items = [];
    for (let j = 0; j < numItems; j++) {
      const product = SEED_PRODUCTS[Math.floor(rand() * SEED_PRODUCTS.length)];
      items.push({
        productCode: product.code,
        productName: product.name,
        specId: product.specId,
        quantity: Math.floor(rand() * 12) + 1,
      });
    }

    const statusIdx = i < 8 ? 0 : i < 14 ? 1 : i < 28 ? 2 : 3;
    const dayOffset = Math.floor(rand() * 7);
    const hour = Math.floor(rand() * 12) + 8;
    const min = Math.floor(rand() * 60);
    const date = new Date(2026, 2, 12 - dayOffset, hour, min);

    tasks.push({
      taskNo: `CK${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${String(i + 1).padStart(3, "0")}`,
      orderNo: `SO-${String(Math.floor(rand() * 90000 + 10000))}`,
      items,
      status: statuses[statusIdx],
      createdAt: date.toISOString().replace("T", " ").slice(0, 19),
      completedAt: statusIdx === 2
        ? new Date(date.getTime() + rand() * 3600000 * 4).toISOString().replace("T", " ").slice(0, 19)
        : undefined,
      operator: operators[Math.floor(rand() * operators.length)],
    });
  }

  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const OUTBOUND_TASKS: OutboundTask[] = generateTasks();

// ─── 仪表盘统计 ───────────────────────────────────────────────────────────────

export const WAREHOUSE_STATS: WarehouseStats = {
  totalProducts: SEED_PRODUCTS.length,
  totalStock: SEED_PRODUCTS.reduce((sum, p) => sum + p.stock, 0),
  pendingTasks: OUTBOUND_TASKS.filter((t) => t.status === "pending").length,
  todayCompleted: OUTBOUND_TASKS.filter((t) => t.status === "completed" && t.createdAt.startsWith("2026-03-12")).length,
  specCount: SEED_SPECS.length,
  lowStockCount: SEED_PRODUCTS.filter((p) => p.status === "low" || p.status === "empty").length,
};

// ─── 库存类型分布统计 ───────────────────────────────────────────────────────

export function getSpecDistribution() {
  const dist: { specId: number; label: string; count: number; stock: number }[] = [];
  for (const spec of SEED_SPECS) {
    const products = SEED_PRODUCTS.filter((p) => p.specId === spec.id);
    dist.push({
      specId: spec.id,
      label: `${spec.name} ${spec.width}×${spec.length}mm`,
      count: products.length,
      stock: products.reduce((s, p) => s + p.stock, 0),
    });
  }
  return dist;
}
