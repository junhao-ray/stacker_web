"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ClipboardList,
  PackageOpen,
  Truck,
  ArrowRight,
  User,
  Clock,
  Loader2,
  Package,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { OUTBOUND_TASKS } from "@/lib/mock-data";

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function OutboundPage() {
  const [searchPending, setSearchPending] = useState("");
  const [searchCompleted, setSearchCompleted] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, picking: 0, completed: 0 };
    for (const t of OUTBOUND_TASKS) {
      if (t.status !== "cancelled") c[t.status as keyof typeof c]++;
    }
    return c;
  }, []);

  const total = counts.pending + counts.picking + counts.completed;

  const pickingTask = useMemo(
    () => OUTBOUND_TASKS.find((t) => t.status === "picking"),
    [],
  );

  const pendingTasks = useMemo(() => {
    return OUTBOUND_TASKS.filter((t) => {
      if (t.status !== "pending") return false;
      if (searchPending) {
        const q = searchPending.toLowerCase();
        return t.taskNo.toLowerCase().includes(q) || t.orderNo.toLowerCase().includes(q) ||
          t.items.some((i) => i.productName.toLowerCase().includes(q));
      }
      return true;
    });
  }, [searchPending]);

  const completedTasks = useMemo(() => {
    return OUTBOUND_TASKS.filter((t) => {
      if (t.status !== "completed") return false;
      if (searchCompleted) {
        const q = searchCompleted.toLowerCase();
        return t.taskNo.toLowerCase().includes(q) || t.orderNo.toLowerCase().includes(q) ||
          t.items.some((i) => i.productName.toLowerCase().includes(q));
      }
      return true;
    });
  }, [searchCompleted]);

  return (
    <div className="p-4 sm:p-6 h-[calc(100vh-3.5rem)] flex flex-col gap-5 overflow-hidden">
      {/* ── 页面标题 + 进度条 ──────────────────────────────── */}
      <div className="space-y-2 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">出库任务</h1>
          <span className="text-sm text-muted-foreground">共 {total} 条任务</span>
        </div>
        <div className="relative h-2 rounded-full bg-secondary overflow-hidden flex">
          <div className="h-full bg-amber-500 transition-all duration-700 first:rounded-l-full" style={{ width: `${total > 0 ? (counts.pending / total) * 100 : 0}%`, opacity: 0.6 }} />
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${total > 0 ? (counts.picking / total) * 100 : 0}%`, opacity: 0.6 }} />
          <div className="h-full bg-emerald-500 transition-all duration-700 last:rounded-r-full" style={{ width: `${total > 0 ? (counts.completed / total) * 100 : 0}%`, opacity: 0.6 }} />
        </div>
      </div>

      {/* ── 三栏布局 ──────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ═══ 左栏 · 待拣货队列 ═══ */}
        <div className="w-[260px] flex-shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <ClipboardList className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">待拣货</p>
              <p className="text-[11px] text-muted-foreground">{counts.pending} 条等待处理</p>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchPending} onChange={(e) => setSearchPending(e.target.value)} placeholder="搜索…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto space-y-1.5 pr-1.5">
            {pendingTasks.map((task, i) => (
              <div
                key={task.taskNo}
                className="flow-card-enter rounded-xl border bg-card p-3 space-y-1.5 hover:shadow-sm hover:border-amber-500/30 transition-all cursor-pointer group"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold">{task.taskNo}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{task.orderNo}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {task.items.slice(0, 2).map((item, j) => (
                    <span key={j} className="text-[10px] text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">
                      {item.productName} <span className="font-mono font-medium text-foreground">×{item.quantity}</span>
                    </span>
                  ))}
                  {task.items.length > 2 && <span className="text-[10px] text-muted-foreground/50">+{task.items.length - 2}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{task.operator} · {task.createdAt.slice(5, 16)}</span>
                  <ChevronRight className="size-3 text-muted-foreground/30 group-hover:text-amber-500 transition-colors" />
                </div>
              </div>
            ))}
            {pendingTasks.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground/50">暂无任务</div>
            )}
          </div>
        </div>

        {/* ═══ 中栏 · 拣货出库 (焦点) ═══ */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {/* Flow arrows label */}
          <div className="flex items-center gap-4 mb-6 w-full max-w-lg">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-amber-500/50" />
            <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">开始拣货</span>
            <svg viewBox="0 0 16 12" className="w-4 h-3 text-amber-500/50"><polygon points="0,0 16,6 0,12" fill="currentColor" /></svg>
          </div>

          {/* ── 主焦点卡片 ── */}
          <div className="w-full max-w-lg">
            <div
              className="relative rounded-3xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-8 shadow-xl shadow-blue-500/5 flow-node-glow"
              style={{ "--glow-color": "rgba(59,130,246,0.15)" } as React.CSSProperties}
            >
              {/* Ambient glow */}
              <div
                className="absolute -inset-px rounded-3xl pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 60%)",
                }}
              />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-16 rounded-full pointer-events-none blur-2xl"
                style={{ background: "rgba(59,130,246,0.15)", animation: "pulseRing 3s ease-in-out infinite" }}
              />

              <div className="relative space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-500/20">
                    <PackageOpen className="size-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold">拣货出库</h2>
                      <Loader2 className="size-4.5 text-blue-500 animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground">当前正在处理的出库任务</p>
                  </div>
                </div>

                {pickingTask ? (
                  <>
                    {/* Divider */}
                    <div className="h-px bg-border/50" />

                    {/* Task info */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-bold">{pickingTask.taskNo}</span>
                      <Badge variant="outline" className="text-sm px-2.5 py-0.5">{pickingTask.orderNo}</Badge>
                    </div>

                    {/* Items — prominent table-like display */}
                    <div className="rounded-xl border bg-background/80 backdrop-blur-sm overflow-hidden">
                      <div className="px-4 py-2 border-b bg-secondary/30">
                        <span className="text-xs font-medium text-muted-foreground">拣货清单</span>
                      </div>
                      {pickingTask.items.map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between px-4 py-3 ${i < pickingTask.items.length - 1 ? "border-b border-border/50" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="size-4 text-blue-500/50" />
                            <span className="text-sm">{item.productName}</span>
                          </div>
                          <span className="font-mono text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {pickingTask.operator && (
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5" />
                          {pickingTask.operator}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {pickingTask.createdAt.slice(0, 16)}
                      </span>
                    </div>

                    {/* CTA — large and prominent */}
                    <Button size="lg" className="w-full gap-2.5 h-12 text-base font-semibold shadow-md shadow-primary/20">
                      确认出库 <ArrowRight className="size-5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="text-center py-10 space-y-2">
                      <PackageOpen className="size-10 text-muted-foreground/20 mx-auto" />
                      <p className="text-sm text-muted-foreground/60">暂无正在拣货的任务</p>
                      <p className="text-xs text-muted-foreground/40">从左侧选择一条待拣货任务开始</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Flow arrows label - outgoing */}
          <div className="flex items-center gap-4 mt-6 w-full max-w-lg">
            <svg viewBox="0 0 16 12" className="w-4 h-3 text-emerald-500/50 rotate-180"><polygon points="0,0 16,6 0,12" fill="currentColor" /></svg>
            <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">出库完成</span>
            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/50 via-emerald-500/30 to-transparent" />
          </div>
        </div>

        {/* ═══ 右栏 · 已出库记录 ═══ */}
        <div className="w-[260px] flex-shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <Truck className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">已出库</p>
              <p className="text-[11px] text-muted-foreground">{counts.completed} 条已完成</p>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchCompleted} onChange={(e) => setSearchCompleted(e.target.value)} placeholder="搜索…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto space-y-1.5 pr-1.5">
            {completedTasks.map((task, i) => (
              <div
                key={task.taskNo}
                className="flow-card-enter rounded-xl border bg-card p-3 space-y-1.5 hover:shadow-sm hover:border-emerald-500/30 transition-all"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold">{task.taskNo}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{task.orderNo}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {task.items.slice(0, 2).map((item, j) => (
                    <span key={j} className="text-[10px] text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">
                      {item.productName} <span className="font-mono font-medium text-foreground">×{item.quantity}</span>
                    </span>
                  ))}
                  {task.items.length > 2 && <span className="text-[10px] text-muted-foreground/50">+{task.items.length - 2}</span>}
                </div>
                <span className="text-[10px] text-muted-foreground block">{task.operator} · {task.createdAt.slice(5, 16)}</span>
              </div>
            ))}
            {completedTasks.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground/50">暂无任务</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
