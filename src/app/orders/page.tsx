"use client";

import { useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  Filter,
  Loader2,
  AlertCircle,
  Inbox,
  FileText,
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
  CardAction,
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
import { Separator } from "@/components/ui/separator";

import type { Order, OrderQueryResponse } from "@/lib/jushuitan";

// ─── Constants ───────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  { value: "", label: "全部状态" },
  { value: "WaitPay", label: "待付款" },
  { value: "WaitConfirm", label: "待确认" },
  { value: "Confirmed", label: "已确认" },
  { value: "Sent", label: "已发货" },
  { value: "Delivered", label: "已签收" },
  { value: "Cancelled", label: "已取消" },
] as const;

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  WaitPay: "outline",
  WaitConfirm: "secondary",
  Confirmed: "default",
  Sent: "default",
  Delivered: "secondary",
  Cancelled: "destructive",
};

function getStatusLabel(status: string) {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANT[status] ?? "outline";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toApiDate(dtLocal: string): string {
  if (!dtLocal) return "";
  return dtLocal.replace("T", " ") + ":00";
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 16);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 16);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [modifiedBegin, setModifiedBegin] = useState(defaultStartDate());
  const [modifiedEnd, setModifiedEnd] = useState(defaultEndDate());
  const [status, setStatus] = useState("");
  const [soId, setSoId] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(30);

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queried, setQueried] = useState(false);

  const fetchOrders = useCallback(
    async (page: number = pageIndex) => {
      setLoading(true);
      setError(null);

      try {
        const body: Record<string, unknown> = {
          page_index: page,
          page_size: pageSize,
        };

        if (modifiedBegin) body.modified_begin = toApiDate(modifiedBegin);
        if (modifiedEnd) body.modified_end = toApiDate(modifiedEnd);
        if (status) body.status = status;
        if (soId.trim()) body.so_ids = soId.split(",").map((s) => s.trim());

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json: OrderQueryResponse = await res.json();

        if (json.code !== 0) {
          setError(json.msg || `错误码: ${json.code}`);
          setOrders([]);
          return;
        }

        setOrders(json.data?.orders ?? []);
        setTotalCount(json.data?.data_count ?? 0);
        setHasNext(json.data?.has_next ?? false);
        setPageIndex(page);
        setQueried(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "请求失败");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [modifiedBegin, modifiedEnd, status, soId, pageIndex, pageSize]
  );

  const handleSearch = () => {
    setPageIndex(1);
    fetchOrders(1);
  };

  const handlePageChange = (newPage: number) => {
    fetchOrders(newPage);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-4 sm:p-6 space-y-6">
        {/* ── Filters Card ───────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              查询条件
            </CardTitle>
            <CardDescription>
              时间范围最长 7 天 · 并发上限 5 次/秒 · 频率上限 100 次/分/店
            </CardDescription>
            <CardAction>
              <Button
                size="lg"
                onClick={handleSearch}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {loading ? "查询中…" : "查询订单"}
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 修改起始时间 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  修改起始时间
                </label>
                <Input
                  type="datetime-local"
                  value={modifiedBegin}
                  onChange={(e) => setModifiedBegin(e.target.value)}
                />
              </div>

              {/* 修改结束时间 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  修改结束时间
                </label>
                <Input
                  type="datetime-local"
                  value={modifiedEnd}
                  onChange={(e) => setModifiedEnd(e.target.value)}
                />
              </div>

              {/* 订单状态 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  订单状态
                </label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value || "__all__"}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 线上订单号 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  线上订单号
                </label>
                <Input
                  value={soId}
                  onChange={(e) => setSoId(e.target.value)}
                  placeholder="多个用逗号分隔"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Error Alert ────────────────────────────────────────────── */}
        {error && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">查询失败</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Results Card ───────────────────────────────────────────── */}
        {queried && !error && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                查询结果
              </CardTitle>
              <CardDescription>
                共{" "}
                <span className="font-semibold text-foreground">
                  {totalCount}
                </span>{" "}
                条记录 · 第{" "}
                <span className="font-semibold text-foreground">
                  {pageIndex}
                </span>{" "}
                / {totalPages} 页
              </CardDescription>
            </CardHeader>

            {orders.length > 0 ? (
              <>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">线上单号</TableHead>
                        <TableHead>内部单号</TableHead>
                        <TableHead>店铺 ID</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">应付金额</TableHead>
                        <TableHead className="pr-4">商品明细</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order, idx) => (
                        <TableRow key={order.o_id ?? idx}>
                          <TableCell className="pl-4 font-mono text-xs">
                            {order.so_id}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {order.o_id}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.shop_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(order.status)}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            ¥{order.pay_amount?.toFixed(2) ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] pr-4">
                            {order.items?.length > 0 ? (
                              <div className="space-y-0.5">
                                {order.items.slice(0, 2).map((item, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                  >
                                    <span className="truncate max-w-[160px]">
                                      {item.name}
                                    </span>
                                    <span className="shrink-0 text-muted-foreground/60">
                                      ×{item.qty}
                                    </span>
                                  </div>
                                ))}
                                {order.items.length > 2 && (
                                  <span className="text-xs text-muted-foreground/50">
                                    +{order.items.length - 2} 更多
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>

                <CardFooter className="justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pageIndex - 1)}
                    disabled={pageIndex <= 1 || loading}
                    className="gap-1.5"
                  >
                    <ChevronLeft className="size-3.5" />
                    上一页
                  </Button>

                  <span className="text-xs text-muted-foreground">
                    第 {pageIndex} / {totalPages} 页 · 每页 {pageSize} 条
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pageIndex + 1)}
                    disabled={!hasNext || loading}
                    className="gap-1.5"
                  >
                    下一页
                    <ChevronRight className="size-3.5" />
                  </Button>
                </CardFooter>
              </>
            ) : (
              <CardContent>
                <div className="flex flex-col items-center justify-center py-16">
                  <Inbox className="mb-3 size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    暂无订单数据
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    请调整查询条件后重试
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ── Initial Guide ──────────────────────────────────────────── */}
        {!queried && !error && (
          <Card className="border-dashed">
            <CardContent>
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="size-7" />
                </div>
                <p className="text-sm font-medium">
                  选择查询条件并点击「查询订单」
                </p>
                <p className="mt-2 max-w-sm text-center text-xs text-muted-foreground leading-relaxed">
                  通过聚水潭开放平台 API 查询订单数据。
                  支持按时间范围、订单状态、线上单号等条件筛选。
                </p>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
