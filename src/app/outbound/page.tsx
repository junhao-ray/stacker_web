"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  PackageOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { OutboundStatus } from "@/lib/types";
import { OUTBOUND_TASKS, SEED_SPECS } from "@/lib/mock-data";

const STATUS_CONFIG: Record<
  OutboundStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof Clock;
    dotColor: string;
    gradient: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  pending: {
    label: "待拣货", variant: "outline", icon: Clock,
    dotColor: "bg-amber-500",
    gradient: "from-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  picking: {
    label: "拣货中", variant: "secondary", icon: PackageOpen,
    dotColor: "bg-blue-500",
    gradient: "from-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "已出库", variant: "default", icon: CheckCircle2,
    dotColor: "bg-emerald-500",
    gradient: "from-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "已取消", variant: "destructive", icon: XCircle,
    dotColor: "bg-red-500",
    gradient: "from-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待拣货" },
  { value: "picking", label: "拣货中" },
  { value: "completed", label: "已出库" },
  { value: "cancelled", label: "已取消" },
] as const;

export default function OutboundPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredTasks = useMemo(() => {
    return OUTBOUND_TASKS.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.taskNo.toLowerCase().includes(q) ||
          t.orderNo.toLowerCase().includes(q) ||
          t.items.some((i) => i.productName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const paged = filteredTasks.slice((page - 1) * pageSize, page * pageSize);

  // Summary counts
  const counts = useMemo(() => {
    const c = { pending: 0, picking: 0, completed: 0, cancelled: 0 };
    for (const t of OUTBOUND_TASKS)
      c[t.status as keyof typeof c]++;
    return c;
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ── 页面标题 ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">出库任务</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理所有出库任务 · 共 {OUTBOUND_TASKS.length} 条记录
        </p>
      </div>

      {/* ── 状态概览卡片 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(Object.entries(STATUS_CONFIG) as [OutboundStatus, typeof STATUS_CONFIG[OutboundStatus]][]).map(
          ([key, config]) => (
            <Card
              key={key}
              size="sm"
              className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                statusFilter === key
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:ring-1 hover:ring-primary/30"
              }`}
              onClick={() => {
                setStatusFilter(statusFilter === key ? "" : key);
                setPage(1);
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />
              <CardContent className="relative flex items-center gap-3 pt-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.iconBg}`}>
                  <config.icon className={`size-5 ${config.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">
                    {counts[key]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* ── 任务列表 ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              出库任务列表
            </CardTitle>
            <CardDescription>
              {statusFilter ? STATUS_CONFIG[statusFilter as OutboundStatus]?.label + "任务" : "全部任务"} · {filteredTasks.length} 条
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── 搜索筛选区 ─────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索任务号、订单号或品种名…"
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter || null}
              onValueChange={(v) => {
                setStatusFilter(v === "全部" ? "" : (v ?? ""));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部状态</SelectItem>
                {STATUS_OPTIONS.filter(opt => opt.value !== "").map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── 任务表格 ───────────────────────────────────────── */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">任务编号</TableHead>
                <TableHead>关联订单</TableHead>
                <TableHead>种子明细</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作员</TableHead>
                <TableHead className="text-right">创建时间</TableHead>
                <TableHead className="text-right pr-4">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((task) => {
                const st = STATUS_CONFIG[task.status];
                return (
                  <TableRow key={task.taskNo} className="group cursor-pointer hover:bg-secondary/50 transition-colors">
                    <TableCell className="pl-4 font-mono text-xs font-medium">
                      {task.taskNo}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {task.orderNo}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="space-y-0.5">
                        {task.items.slice(0, 2).map((item, i) => (
                          <div
                            key={i}
                            className="truncate text-xs text-muted-foreground"
                          >
                            {item.productName}
                          </div>
                        ))}
                        {task.items.length > 2 && (
                          <span className="text-xs text-muted-foreground/50">
                            +{task.items.length - 2} 更多
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums font-medium">
                      {task.items.reduce((s, i) => s + i.quantity, 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={`size-1.5 rounded-full ${st.dotColor}`} />
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.operator ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {task.createdAt.slice(0, 16)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {task.status === "pending" && (
                        <Button size="xs" variant="outline" className="gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          开始拣货
                          <ArrowRight className="size-3" />
                        </Button>
                      )}
                      {task.status === "picking" && (
                        <Button size="xs" className="gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          确认出库
                          <ArrowRight className="size-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <p className="text-sm text-muted-foreground">
                      暂无匹配的出库任务
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="gap-1.5"
          >
            <ChevronLeft className="size-3.5" />
            上一页
          </Button>
          <span className="text-xs text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="gap-1.5"
          >
            下一页
            <ChevronRight className="size-3.5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
