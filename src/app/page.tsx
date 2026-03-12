"use client";

import {
  Package,
  PackageOpen,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Ruler,
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

import {
  WAREHOUSE_STATS,
  OUTBOUND_TASKS,
  getSpecDistribution,
} from "@/lib/mock-data";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待拣货", variant: "outline" },
  picking: { label: "拣货中", variant: "secondary" },
  completed: { label: "已出库", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export default function DashboardPage() {
  const stats = WAREHOUSE_STATS;
  const recentTasks = OUTBOUND_TASKS.slice(0, 8);
  const specDist = getSpecDistribution();

  const statCards = [
    {
      title: "种子品种",
      value: stats.totalProducts.toLocaleString(),
      subtitle: "已录入品种总数",
      icon: Package,
    },
    {
      title: "库存总量",
      value: stats.totalStock.toLocaleString(),
      subtitle: "袋 / 罐",
      icon: Boxes,
    },
    {
      title: "待出库",
      value: stats.pendingTasks.toString(),
      subtitle: "待拣货任务",
      icon: PackageOpen,
    },
    {
      title: "今日出库",
      value: stats.todayCompleted.toString(),
      subtitle: "已完成任务",
      icon: TrendingUp,
    },
    {
      title: "包装规格",
      value: stats.specCount.toString(),
      subtitle: "种规格类型",
      icon: Ruler,
    },
    {
      title: "低库存预警",
      value: stats.lowStockCount.toString(),
      subtitle: "需补货品种",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ── 统计卡片 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.title} size="sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
              <CardDescription className="text-xs">
                {card.title}
              </CardDescription>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── 最近出库任务 ───────────────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>最近出库任务</CardTitle>
            <CardDescription>近期创建的出库任务列表</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">任务编号</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>品种 / 数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="pr-4 text-right">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTasks.map((task) => {
                  const st = STATUS_MAP[task.status] ?? STATUS_MAP.pending;
                  return (
                    <TableRow key={task.taskNo}>
                      <TableCell className="pl-4 font-mono text-xs">
                        {task.taskNo}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.orderNo}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {task.items.length} 种 /{" "}
                          {task.items.reduce((s, i) => s + i.quantity, 0)} 件
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
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

        {/* ── 规格分布 ─────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>规格库存分布</CardTitle>
            <CardDescription>各包装规格对应的品种数与库存量</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {specDist.map((d) => {
              const maxStock = Math.max(...specDist.map((s) => s.stock), 1);
              const pct = Math.round((d.stock / maxStock) * 100);
              return (
                <div key={d.specId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      #{d.specId} {d.label}
                    </span>
                    <span className="text-muted-foreground">
                      {d.count} 种 · {d.stock.toLocaleString()} 件
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
