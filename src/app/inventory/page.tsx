"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ── 概览 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {SEED_PRODUCTS.length}
              </p>
              <p className="text-xs text-muted-foreground">品种总数</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {SEED_PRODUCTS.reduce((s, p) => s + p.stock, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">库存总量</p>
            </div>
          </CardContent>
        </Card>
        <Card
          size="sm"
          className={stockFilter === "low" ? "ring-2 ring-primary" : "cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all"}
          onClick={() => { setStockFilter(stockFilter === "low" ? "" : "low"); setPage(1); }}
        >
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                {lowCount}
              </p>
              <p className="text-xs text-muted-foreground">低库存</p>
            </div>
          </CardContent>
        </Card>
        <Card
          size="sm"
          className={stockFilter === "empty" ? "ring-2 ring-primary" : "cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all"}
          onClick={() => { setStockFilter(stockFilter === "empty" ? "" : "empty"); setPage(1); }}
        >
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {emptyCount}
              </p>
              <p className="text-xs text-muted-foreground">零库存</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 库存表格 ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>库存明细</CardTitle>
          <CardDescription>
            共 {filtered.length} 个品种
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编码</TableHead>
                <TableHead>品种名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>规格</TableHead>
                <TableHead>库位号</TableHead>
                <TableHead className="text-right">库存</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((product) => {
                const spec = SEED_SPECS.find((s) => s.id === product.specId);
                return (
                  <TableRow key={product.code}>
                    <TableCell className="font-mono text-xs font-medium">
                      {product.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      #{product.specId}{" "}
                      {spec ? `${spec.width}×${spec.length}cm` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {product.location}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {product.stock}
                    </TableCell>
                    <TableCell>
                      {product.status === "normal" && (
                        <Badge variant="default">正常</Badge>
                      )}
                      {product.status === "low" && (
                        <Badge variant="outline" className="border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400">
                          低库存
                        </Badge>
                      )}
                      {product.status === "empty" && (
                        <Badge variant="destructive">零库存</Badge>
                      )}
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
