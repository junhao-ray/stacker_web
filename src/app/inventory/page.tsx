"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
  Boxes,
  MapPin,
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

import { SEED_PRODUCTS, SEED_SPECS } from "@/lib/mock-data";

const STOCK_STATUSES = [
  { value: "", label: "全部状态" },
  { value: "normal", label: "正常" },
  { value: "low", label: "低库存" },
  { value: "empty", label: "零库存" },
] as const;

const SPEC_OPTIONS = [
  { value: "", label: "全部规格" },
  ...SEED_SPECS.map((s) => ({
    value: String(s.id),
    label: `#${s.id} ${s.width}×${s.length}cm`,
  })),
] as const;

const CATEGORIES = [
  { value: "", label: "全部类型" },
  ...Array.from(new Set(SEED_PRODUCTS.map((p) => p.category))).map((c) => ({
    value: c,
    label: c,
  })),
] as const;

const STATUS_STYLE: Record<string, { dotColor: string; label: string; textColor: string }> = {
  normal: { dotColor: "bg-emerald-500", label: "正常", textColor: "text-emerald-600 dark:text-emerald-400" },
  low:    { dotColor: "bg-amber-500",   label: "低库存", textColor: "text-amber-600 dark:text-amber-400" },
  empty:  { dotColor: "bg-red-500",     label: "零库存", textColor: "text-red-600 dark:text-red-400" },
};

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    return SEED_PRODUCTS.filter((p) => {
      if (stockFilter && p.status !== stockFilter) return false;
      if (specFilter && String(p.specId) !== specFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, stockFilter, specFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const lowCount = SEED_PRODUCTS.filter((p) => p.status === "low").length;
  const emptyCount = SEED_PRODUCTS.filter((p) => p.status === "empty").length;
  const totalStock = SEED_PRODUCTS.reduce((s, p) => s + p.stock, 0);
  const maxSingleStock = Math.max(...SEED_PRODUCTS.map(p => p.stock));

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ── 页面标题 ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">库存管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理 {SEED_PRODUCTS.length} 个品种 · 总库存 {totalStock.toLocaleString()} 件
        </p>
      </div>

      {/* ── 概览卡片 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card size="sm" className="relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Package className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {SEED_PRODUCTS.length}
              </p>
              <p className="text-xs text-muted-foreground">品种总数</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Boxes className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {totalStock.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">库存总量</p>
            </div>
          </CardContent>
        </Card>
        <Card
          size="sm"
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
            stockFilter === "low"
              ? "ring-2 ring-primary shadow-lg"
              : "hover:ring-1 hover:ring-primary/30"
          }`}
          onClick={() => { setStockFilter(stockFilter === "low" ? "" : "low"); setPage(1); }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {lowCount}
              </p>
              <p className="text-xs text-muted-foreground">低库存</p>
            </div>
          </CardContent>
        </Card>
        <Card
          size="sm"
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
            stockFilter === "empty"
              ? "ring-2 ring-primary shadow-lg"
              : "hover:ring-1 hover:ring-primary/30"
          }`}
          onClick={() => { setStockFilter(stockFilter === "empty" ? "" : "empty"); setPage(1); }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent" />
          <CardContent className="relative flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {emptyCount}
              </p>
              <p className="text-xs text-muted-foreground">零库存</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 库存表格 ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              库存明细
            </CardTitle>
            <CardDescription>
              {filtered.length} 个品种
              {(stockFilter || specFilter || categoryFilter || search) && " (已筛选)"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── 筛选区 ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索编码、品种名或库位号…"
                className="pl-8"
              />
            </div>
            <Select
              value={categoryFilter || null}
              onValueChange={(v) => { setCategoryFilter(v === "全部" ? "" : (v ?? "")); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部类型</SelectItem>
                {CATEGORIES.filter(c => c.value !== "").map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={specFilter || null}
              onValueChange={(v) => { setSpecFilter(v === "全部" ? "" : (v ?? "")); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="全部规格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部规格</SelectItem>
                {SPEC_OPTIONS.filter(s => s.value !== "").map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stockFilter || null}
              onValueChange={(v) => { setStockFilter(v === "全部" ? "" : (v ?? "")); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部状态</SelectItem>
                {STOCK_STATUSES.filter(st => st.value !== "").map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── 品种表格 ───────────────────────────────────────── */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">编码</TableHead>
                <TableHead>品种名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>规格</TableHead>
                <TableHead>库位号</TableHead>
                <TableHead>库存</TableHead>
                <TableHead className="pr-4">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((product) => {
                const spec = SEED_SPECS.find((s) => s.id === product.specId);
                const stockPct = maxSingleStock > 0 ? (product.stock / maxSingleStock) * 100 : 0;
                const st = STATUS_STYLE[product.status] ?? STATUS_STYLE.normal;
                return (
                  <TableRow key={product.code} className="group cursor-pointer hover:bg-secondary/50 transition-colors">
                    <TableCell className="pl-4 font-mono text-xs font-medium">
                      {product.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      #{product.specId}{" "}
                      {spec ? `${spec.width}×${spec.length}cm` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {product.location}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-secondary">
                          <div
                            className={`h-full rounded-full ${st.dotColor} transition-all`}
                            style={{ width: `${stockPct}%`, opacity: 0.5 }}
                          />
                        </div>
                        <span className="font-mono tabular-nums font-semibold text-sm">
                          {product.stock}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`size-1.5 rounded-full ${st.dotColor}`} />
                        <span className={`text-xs font-medium ${st.textColor}`}>
                          {st.label}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <p className="text-sm text-muted-foreground">
                      暂无匹配的库存记录
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
            第 {page} / {totalPages} 页 · 每页 {pageSize} 条
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
