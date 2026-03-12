import type {
  SeedSpec,
  SeedProduct,
  OutboundTask,
  OutboundStatus,
  WarehouseStats,
} from "./types";

// ─── 16 个包装规格（来自用户提供的规格表） ───────────────────────────────────

export const SEED_SPECS: SeedSpec[] = [
  { id: 1,  thinness: "",      thickness: 6.5,   width: 6.5,  length: 12,   packType: "罐装" },
  { id: 2,  thinness: "0.01",  thickness: 0.02,  width: 8,    length: 12.5, packType: "袋装" },
  { id: 3,  thinness: "0.01",  thickness: 0.02,  width: 9.5,  length: 14.5, packType: "袋装" },
  { id: 4,  thinness: "0.01",  thickness: 0.043, width: 10,   length: 16,   packType: "袋装" },
  { id: 5,  thinness: "0.01",  thickness: 0.02,  width: 10.5, length: 15,   packType: "袋装" },
  { id: 6,  thinness: "0.01",  thickness: 0.04,  width: 11,   length: 16.5, packType: "袋装" },
  { id: 7,  thinness: "0.01",  thickness: 0.035, width: 11,   length: 17.5, packType: "袋装" },
  { id: 8,  thinness: "0.01",  thickness: 0.075, width: 12,   length: 17,   packType: "袋装" },
  { id: 9,  thinness: "0.01",  thickness: 0.16,  width: 12,   length: 18,   packType: "袋装" },
  { id: 10, thinness: "0.01",  thickness: 0.14,  width: 13,   length: 19,   packType: "袋装" },
  { id: 11, thinness: "0.01",  thickness: 0.14,  width: 14,   length: 21,   packType: "袋装" },
  { id: 12, thinness: "0.01",  thickness: 0.2,   width: 14,   length: 22,   packType: "袋装" },
  { id: 13, thinness: "0.01",  thickness: 0.1,   width: 15,   length: 22,   packType: "袋装" },
  { id: 14, thinness: "0.01",  thickness: 0.12,  width: 15.5, length: 25,   packType: "袋装" },
  { id: 15, thinness: "0.01",  thickness: 0.62,  width: 16,   length: 24,   packType: "袋装" },
  { id: 16, thinness: "0.01",  thickness: 0.18,  width: 17,   length: 25,   packType: "袋装" },
];

// ─── Mock 种子品种 ───────────────────────────────────────────────────────────

const SEED_CATEGORIES = [
  "蔬菜", "花卉", "瓜果", "草本", "粮食", "药材", "牧草", "香料",
];

const SEED_NAMES: Record<string, string[]> = {
  蔬菜: ["番茄", "黄瓜", "辣椒", "茄子", "白菜", "菠菜", "芹菜", "萝卜", "胡萝卜", "生菜", "西兰花", "豆角", "豌豆", "南瓜", "冬瓜", "苦瓜", "丝瓜", "芦笋", "蒜苔", "洋葱", "韭菜", "香菜", "莴苣", "空心菜", "油菜", "茼蒿", "西红柿", "甜椒"],
  花卉: ["玫瑰", "百合", "菊花", "向日葵", "康乃馨", "薰衣草", "郁金香", "牡丹", "月季", "紫罗兰", "雏菊", "矢车菊", "满天星", "绣球花", "牵牛花", "三色堇", "报春花", "波斯菊", "虞美人"],
  瓜果: ["西瓜", "甜瓜", "哈密瓜", "草莓", "蓝莓", "猕猴桃", "葡萄", "甜橙", "柚子", "樱桃", "桃子", "杏子", "李子", "火龙果", "枇杷"],
  草本: ["薄荷", "罗勒", "迷迭香", "百里香", "鼠尾草", "柠檬草", "甜叶菊", "紫苏", "茴香"],
  粮食: ["水稻", "小麦", "玉米", "高粱", "小米", "燕麦", "大麦", "荞麦", "黑米", "糯米", "红豆", "绿豆", "黄豆"],
  药材: ["枸杞", "当归", "黄芪", "党参", "金银花", "板蓝根", "决明子", "丹参", "白术", "甘草"],
  牧草: ["黑麦草", "苜蓿", "狼尾草", "高羊茅", "早熟禾", "百慕大", "三叶草"],
  香料: ["花椒", "八角", "桂皮", "丁香", "小茴香", "孜然", "白胡椒", "黑胡椒"],
};

const LOCATION_ZONES = ["A", "B", "C", "D", "E", "F"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateProducts(): SeedProduct[] {
  const rand = seededRandom(42);
  const products: SeedProduct[] = [];
  let idx = 0;

  for (const category of SEED_CATEGORIES) {
    const names = SEED_NAMES[category] || [];
    for (const name of names) {
      // Each seed variety can have multiple spec variants
      const numVariants = Math.floor(rand() * 3) + 1;
      for (let v = 0; v < numVariants; v++) {
        idx++;
        const specId = Math.floor(rand() * 16) + 1;
        const stock = Math.floor(rand() * 500);
        const zone = LOCATION_ZONES[Math.floor(rand() * LOCATION_ZONES.length)];
        const shelf = String(Math.floor(rand() * 20) + 1).padStart(2, "0");
        const slot = String(Math.floor(rand() * 30) + 1).padStart(2, "0");

        products.push({
          code: `SD${String(idx).padStart(5, "0")}`,
          name: numVariants > 1 ? `${name}种子 (${SEED_SPECS[specId - 1].width}×${SEED_SPECS[specId - 1].length}cm)` : `${name}种子`,
          category,
          specId,
          stock,
          location: `${zone}-${shelf}-${slot}`,
          status: stock === 0 ? "empty" : stock < 30 ? "low" : "normal",
        });
      }
    }
  }

  return products;
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
        quantity: Math.floor(rand() * 50) + 1,
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

// ─── 规格分布统计 ─────────────────────────────────────────────────────────────

export function getSpecDistribution() {
  const dist: { specId: number; label: string; count: number; stock: number }[] = [];
  for (const spec of SEED_SPECS) {
    const products = SEED_PRODUCTS.filter((p) => p.specId === spec.id);
    dist.push({
      specId: spec.id,
      label: `${spec.width}×${spec.length}cm`,
      count: products.length,
      stock: products.reduce((s, p) => s + p.stock, 0),
    });
  }
  return dist;
}
