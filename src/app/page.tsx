"use client";

import {
  Package,
  PackageOpen,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Ruler,
  ArrowRight,
  Clock,
  Activity,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  WAREHOUSE_STATS,
  OUTBOUND_TASKS,
  SEED_PRODUCTS,
  SEED_SPECS,
  getSpecDistribution,
} from "@/lib/mock-data";

// ─── 统一配色系统 ────────────────────────────────────────────────────────────
const SPEC_COLORS = [
  "bg-amber-500",  "bg-blue-500",    "bg-emerald-500", "bg-violet-500",
  "bg-rose-500",   "bg-teal-500",    "bg-indigo-500",  "bg-fuchsia-500",
  "bg-amber-500",  "bg-blue-500",    "bg-emerald-500", "bg-violet-500",
  "bg-rose-500",   "bg-teal-500",    "bg-indigo-500",  "bg-fuchsia-500",
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; dotColor: string }> = {
  pending:   { label: "待拣货", variant: "outline",     dotColor: "bg-amber-500" },
  picking:   { label: "拣货中", variant: "secondary",   dotColor: "bg-blue-500" },
  completed: { label: "已出库", variant: "default",     dotColor: "bg-emerald-500" },
  cancelled: { label: "已取消", variant: "destructive", dotColor: "bg-red-500" },
};

const CATEGORY_DIST = Array.from(
  SEED_PRODUCTS.reduce((map, product) => {
    map.set(product.category, (map.get(product.category) ?? 0) + 1);
    return map;
  }, new Map<string, number>()),
)
  .sort((left, right) => right[1] - left[1])
  .map(([name, count]) => ({ name, count }));

const TOTAL_VARIETIES = CATEGORY_DIST.reduce((sum, category) => sum + category.count, 0);

export default function DashboardPage() {
  const stats = WAREHOUSE_STATS;
  const recentTasks = OUTBOUND_TASKS.slice(0, 8);
  const specDist = getSpecDistribution();
  const maxStock = Math.max(...specDist.map((s) => s.stock), 1);

  const statCards = [
    {
      title: "库存类型", value: stats.totalProducts.toLocaleString(),
      subtitle: "已录入类型总数", icon: Package,
      gradient: "from-blue-500/10 to-transparent", iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "库存总量", value: stats.totalStock.toLocaleString(),
      subtitle: "件", icon: Boxes,
      gradient: "from-emerald-500/10 to-transparent", iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "待出库", value: stats.pendingTasks.toString(),
      subtitle: "待拣货任务", icon: PackageOpen,
      gradient: "from-amber-500/10 to-transparent", iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "今日出库", value: stats.todayCompleted.toString(),
      subtitle: "已完成任务", icon: TrendingUp,
      gradient: "from-violet-500/10 to-transparent", iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "尺寸类型", value: stats.specCount.toString(),
      subtitle: "种宽高组合", icon: Ruler,
      gradient: "from-teal-500/10 to-transparent", iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      title: "低库存预警", value: stats.lowStockCount.toString(),
      subtitle: "需补货类型", icon: AlertTriangle,
      gradient: "from-rose-500/10 to-transparent", iconBg: "bg-rose-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ── 页面标题 ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          仓库运营概览 · 实时数据监控
        </p>
      </div>

      {/* ── 统计卡片 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.title} size="sm" className="relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
            <CardContent className="relative pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.icon className={`size-4.5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums leading-none mb-1">
                {card.value}
              </div>
              <p className="text-[11px] text-muted-foreground">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── 最近出库任务 ───────────────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                最近出库任务
              </CardTitle>
              <CardDescription>近期创建的出库任务</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
              查看全部 <ArrowRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">任务编号</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>类型 / 数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="pr-4 text-right">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTasks.map((task) => {
                  const st = STATUS_MAP[task.status] ?? STATUS_MAP.pending;
                  return (
                    <TableRow key={task.taskNo} className="group/row cursor-pointer hover:bg-secondary/50 transition-colors">
                      <TableCell className="pl-4 font-mono text-xs font-medium">
                        {task.taskNo}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.orderNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium tabular-nums">
                            {task.items.length}
                          </span>
                          <span className="text-xs text-muted-foreground">种</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-sm font-medium tabular-nums">
                            {task.items.reduce((s, i) => s + i.quantity, 0)}
                          </span>
                          <span className="text-xs text-muted-foreground">件</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`size-1.5 rounded-full ${st.dotColor}`} />
                          <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                        {task.createdAt.slice(5, 16)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── 右侧面板 ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── 任务状态摘要 ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-muted-foreground" />
                任务状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(STATUS_MAP) as [string, typeof STATUS_MAP[string]][]).map(([key, config]) => {
                const count = OUTBOUND_TASKS.filter((t) => t.status === key).length;
                const pct = OUTBOUND_TASKS.length > 0 ? (count / OUTBOUND_TASKS.length) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-16">
                      <div className={`size-2 rounded-full ${config.dotColor}`} />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${config.dotColor} transition-all duration-700`}
                        style={{ width: `${pct}%`, opacity: 0.6 }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ── 类型分布 ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4 text-muted-foreground" />
                库存分类
              </CardTitle>
              <CardDescription className="text-xs">
                {CATEGORY_DIST.length} 个分类 · {TOTAL_VARIETIES} 种库存类型
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {CATEGORY_DIST.map((cat, idx) => {
                const pct = TOTAL_VARIETIES > 0 ? (cat.count / TOTAL_VARIETIES) * 100 : 0;
                const barColor = SPEC_COLORS[idx % SPEC_COLORS.length];
                return (
                  <div key={cat.name} className="flex items-center gap-3 group/cat rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-secondary/50">
                    <span className="text-xs w-10 text-muted-foreground">{cat.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%`, opacity: 0.5 }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-6 text-right">{cat.count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 库存类型分布 ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="size-4 text-muted-foreground" />
            库存类型分布
          </CardTitle>
          <CardDescription>
            {SEED_SPECS.length} 种库存类型的库存量对比
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {specDist.map((d) => {
              const pct = maxStock > 0 ? (d.stock / maxStock) * 100 : 0;
              const barColor = SPEC_COLORS[d.specId - 1];
              return (
                <div key={d.specId} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                  <span className="text-[10px] font-semibold tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.stock.toLocaleString()}
                  </span>
                  <div className="w-full flex flex-col justify-end h-28">
                    <div
                      className={`w-full rounded-t-md ${barColor} transition-all duration-500 group-hover:opacity-80`}
                      style={{ height: `${pct}%`, opacity: 0.45 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">#{d.specId}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
            <span>最小库存: {Math.min(...specDist.map(d => d.stock)).toLocaleString()} 件</span>
            <span>平均: {Math.round(specDist.reduce((s, d) => s + d.stock, 0) / specDist.length).toLocaleString()} 件</span>
            <span>最大库存: {maxStock.toLocaleString()} 件</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
