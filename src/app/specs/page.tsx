"use client";

import { useState } from "react";
import {
  Ruler,
  Package,
  Layers,
  BarChart3,
  ChevronRight,
  Box,
  ArrowUpDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { SEED_SPECS, getSpecDistribution } from "@/lib/mock-data";

// ─── Color palette for spec cards ───────────────────────────────────────────
const SPEC_COLORS = [
  { bg: "from-amber-500/15 to-orange-500/5",  border: "border-amber-500/20",  accent: "text-amber-600 dark:text-amber-400",  bar: "bg-amber-500" },
  { bg: "from-blue-500/15 to-cyan-500/5",     border: "border-blue-500/20",   accent: "text-blue-600 dark:text-blue-400",    bar: "bg-blue-500" },
  { bg: "from-emerald-500/15 to-green-500/5", border: "border-emerald-500/20", accent: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  { bg: "from-violet-500/15 to-purple-500/5", border: "border-violet-500/20", accent: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
  { bg: "from-rose-500/15 to-pink-500/5",     border: "border-rose-500/20",   accent: "text-rose-600 dark:text-rose-400",    bar: "bg-rose-500" },
  { bg: "from-teal-500/15 to-cyan-500/5",     border: "border-teal-500/20",   accent: "text-teal-600 dark:text-teal-400",    bar: "bg-teal-500" },
  { bg: "from-indigo-500/15 to-blue-500/5",   border: "border-indigo-500/20", accent: "text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500" },
  { bg: "from-fuchsia-500/15 to-pink-500/5",  border: "border-fuchsia-500/20", accent: "text-fuchsia-600 dark:text-fuchsia-400", bar: "bg-fuchsia-500" },
];

function getColor(idx: number) {
  return SPEC_COLORS[idx % SPEC_COLORS.length];
}

export default function SpecsPage() {
  const dist = getSpecDistribution();
  const maxStock = Math.max(...dist.map((d) => d.stock));
  const maxArea = Math.max(...SEED_SPECS.map((s) => s.width * s.length));
  const totalStock = dist.reduce((s, d) => s + d.stock, 0);
  const totalVarieties = dist.reduce((s, d) => s + d.count, 0);
  const [selectedSpec, setSelectedSpec] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"id" | "area" | "stock">("id");

  const sortedSpecs = [...SEED_SPECS].sort((a, b) => {
    if (sortBy === "area") return (b.width * b.length) - (a.width * a.length);
    if (sortBy === "stock") {
      const sa = dist.find((d) => d.specId === a.id)?.stock ?? 0;
      const sb = dist.find((d) => d.specId === b.id)?.stock ?? 0;
      return sb - sa;
    }
    return a.id - b.id;
  });

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ── 页面标题区 ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">规格管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理 {SEED_SPECS.length} 种种子包装规格 · 总库存 {totalStock.toLocaleString()} 件 · 覆盖 {totalVarieties} 个品种
        </p>
      </div>

      {/* ── 概览统计区 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card size="sm" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Layers className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{SEED_SPECS.length}</p>
              <p className="text-xs text-muted-foreground">包装规格</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Package className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{totalStock.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">总库存</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <BarChart3 className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{totalVarieties}</p>
              <p className="text-xs text-muted-foreground">品种数</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Box className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {SEED_SPECS.filter((s) => s.packType === "罐装").length} / {SEED_SPECS.filter((s) => s.packType === "袋装").length}
              </p>
              <p className="text-xs text-muted-foreground">罐装 / 袋装</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 规格卡片网格 ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">包装规格总览</h2>
            <p className="text-xs text-muted-foreground mt-0.5">点击卡片查看详情</p>
          </div>
          <div className="flex gap-1.5">
            {(["id", "area", "stock"] as const).map((key) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "outline"}
                size="xs"
                onClick={() => setSortBy(key)}
                className="gap-1 text-xs"
              >
                <ArrowUpDown className="size-3" />
                {key === "id" ? "序号" : key === "area" ? "面积" : "库存"}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {sortedSpecs.map((spec) => {
            const d = dist.find((x) => x.specId === spec.id);
            const area = spec.width * spec.length;
            const stockPct = maxStock > 0 ? ((d?.stock ?? 0) / maxStock) * 100 : 0;
            const color = getColor(spec.id - 1);
            const isSelected = selectedSpec === spec.id;

            return (
              <div
                key={spec.id}
                className={`
                  group relative cursor-pointer rounded-xl border p-4 transition-all duration-200
                  hover:shadow-md hover:-translate-y-0.5
                  ${isSelected
                    ? `ring-2 ring-primary shadow-lg ${color.border} bg-gradient-to-br ${color.bg}`
                    : `${color.border} bg-gradient-to-br ${color.bg} hover:ring-1 hover:ring-primary/30`
                  }
                `}
                onClick={() => setSelectedSpec(isSelected ? null : spec.id)}
              >
                {/* 序号标签 */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold ${color.accent}`}>
                    #{spec.id}
                  </span>
                  <Badge
                    variant={spec.packType === "罐装" ? "default" : "secondary"}
                    className="text-[10px] h-5"
                  >
                    {spec.packType}
                  </Badge>
                </div>

                {/* 尺寸展示 */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold tabular-nums">
                      {spec.width}
                    </span>
                    <span className="text-muted-foreground text-xs">×</span>
                    <span className="text-xl font-bold tabular-nums">
                      {spec.length}
                    </span>
                    <span className="text-xs text-muted-foreground ml-0.5">cm</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    面积 {area.toFixed(0)} cm² · 厚 {spec.thickness} cm
                  </p>
                </div>

                {/* 小尺寸预览 */}
                <div className="flex items-end gap-3 mb-3">
                  <div
                    className={`rounded border border-current/10 ${color.bar} opacity-15`}
                    style={{
                      width: `${Math.max(16, (spec.width / 17) * 60)}px`,
                      height: `${Math.max(20, (spec.length / 25) * 48)}px`,
                    }}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">品种</span>
                      <span className="font-medium tabular-nums">{d?.count ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">库存</span>
                      <span className="font-semibold tabular-nums">{(d?.stock ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 库存占比进度条 */}
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${color.bar} transition-all duration-500`}
                    style={{ width: `${stockPct}%`, opacity: 0.7 }}
                  />
                </div>

                {/* 展开的详情区 */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-current/5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">薄度</span>
                        <p className="font-mono font-medium">{spec.thinness || "—"} cm</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">厚度</span>
                        <p className="font-mono font-medium">{spec.thickness} cm</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">宽度</span>
                        <p className="font-mono font-medium">{spec.width} cm</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">长度</span>
                        <p className="font-mono font-medium">{spec.length} cm</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* hover chevron */}
                <ChevronRight
                  className={`absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/30 transition-all
                    group-hover:text-muted-foreground/60 group-hover:translate-x-0.5
                    ${isSelected ? "rotate-90" : ""}
                  `}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 尺寸可视化对比 ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="size-4 text-muted-foreground" />
            尺寸对比
          </CardTitle>
          <CardDescription>
            所有规格按实际比例展示，直观对比种子袋大小差异
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-center gap-3 flex-wrap py-4">
            {SEED_SPECS.map((spec) => {
              const color = getColor(spec.id - 1);
              const wPx = Math.max(28, Math.round((spec.width / 17) * 90));
              const hPx = Math.max(36, Math.round((spec.length / 25) * 140));

              return (
                <div
                  key={spec.id}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className={`
                      relative rounded-lg border-2 transition-all duration-300 cursor-pointer
                      ${color.border} bg-gradient-to-b ${color.bg}
                      group-hover:shadow-lg group-hover:scale-105 group-hover:-translate-y-1
                      ${selectedSpec === spec.id ? "ring-2 ring-primary shadow-lg scale-105 -translate-y-1" : ""}
                    `}
                    style={{ width: `${wPx}px`, height: `${hPx}px` }}
                    onClick={() => setSelectedSpec(selectedSpec === spec.id ? null : spec.id)}
                  >
                    {/* 内部纹理线条 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden opacity-[0.06]">
                      {Array.from({ length: Math.floor(hPx / 12) }, (_, i) => (
                        <div
                          key={i}
                          className="w-full border-b border-current"
                          style={{ height: "12px" }}
                        />
                      ))}
                    </div>
                    {/* 中心尺寸标注 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-[9px] font-mono font-bold ${color.accent} leading-none`}>
                        {spec.width}×{spec.length}
                      </span>
                    </div>
                  </div>
                  {/* 底部标签 */}
                  <div className="text-center">
                    <span className={`text-[10px] font-bold ${color.accent}`}>
                      #{spec.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 库存分布横向条形图 ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            库存分布
          </CardTitle>
          <CardDescription>
            各规格库存量对比 · 最大库存 {maxStock.toLocaleString()} 件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {dist.map((d) => {
            const spec = SEED_SPECS.find((s) => s.id === d.specId)!;
            const pct = maxStock > 0 ? (d.stock / maxStock) * 100 : 0;
            const color = getColor(d.specId - 1);

            return (
              <div
                key={d.specId}
                className="group flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-secondary/50"
                onClick={() => setSelectedSpec(selectedSpec === d.specId ? null : d.specId)}
              >
                <div className="w-14 shrink-0 flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${color.accent} tabular-nums`}>
                    #{d.specId}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-6 rounded-md bg-secondary relative overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-md ${color.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%`, opacity: 0.25 }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-md ${color.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%`, opacity: 0.45 }}
                    />
                    <div className="absolute inset-0 flex items-center px-2.5">
                      <span className="text-[11px] text-foreground/70 font-medium">
                        {spec.width}×{spec.length}cm
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className="text-xs font-semibold tabular-nums">
                    {d.stock.toLocaleString()}
                  </span>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {d.count} 种
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── 详细规格表 ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="size-4 text-muted-foreground" />
            规格明细表
          </CardTitle>
          <CardDescription>
            完整的包装规格参数信息
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 w-[60px]">序号</TableHead>
                <TableHead>尺寸</TableHead>
                <TableHead>薄度</TableHead>
                <TableHead>厚度</TableHead>
                <TableHead>面积</TableHead>
                <TableHead>包装</TableHead>
                <TableHead className="text-right">品种数</TableHead>
                <TableHead>库存占比</TableHead>
                <TableHead className="text-right pr-4">库存</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SEED_SPECS.map((spec) => {
                const d = dist.find((x) => x.specId === spec.id);
                const area = spec.width * spec.length;
                const pct = totalStock > 0 ? ((d?.stock ?? 0) / totalStock) * 100 : 0;
                const color = getColor(spec.id - 1);

                return (
                  <TableRow
                    key={spec.id}
                    className={`cursor-pointer transition-colors ${selectedSpec === spec.id ? "bg-secondary" : ""}`}
                    onClick={() => setSelectedSpec(selectedSpec === spec.id ? null : spec.id)}
                  >
                    <TableCell className="pl-4">
                      <span className={`font-mono font-bold text-xs ${color.accent}`}>
                        #{spec.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold">
                        {spec.width} × {spec.length}
                      </span>
                      <span className="text-xs text-muted-foreground ml-0.5">cm</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {spec.thinness || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {spec.thickness}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {area.toFixed(0)} cm²
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={spec.packType === "罐装" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {spec.packType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {d?.count ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 max-w-[80px] rounded-full bg-secondary">
                          <div
                            className={`h-full rounded-full ${color.bar} transition-all`}
                            style={{ width: `${pct}%`, opacity: 0.6 }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4 font-mono tabular-nums font-semibold">
                      {(d?.stock ?? 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
