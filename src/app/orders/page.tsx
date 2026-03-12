"use client";

import { useState, useCallback } from "react";
import type { Order, OrderQueryResponse } from "@/lib/jushuitan";

const ORDER_STATUSES = [
  { value: "", label: "全部状态" },
  { value: "WaitPay", label: "待付款" },
  { value: "WaitConfirm", label: "待确认" },
  { value: "Confirmed", label: "已确认" },
  { value: "Sent", label: "已发货" },
  { value: "Delivered", label: "已签收" },
  { value: "Cancelled", label: "已取消" },
];

const STATUS_COLORS: Record<string, string> = {
  WaitPay: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  WaitConfirm: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Sent: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Delivered: "bg-green-500/15 text-green-400 border-green-500/30",
  Cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

function getStatusLabel(status: string) {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

// ─── Helper: format date for input[type=datetime-local] → API string ────────
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

export default function OrdersPage() {
  // ─── Filter State ──────────────────────────────────────────────────────────
  const [modifiedBegin, setModifiedBegin] = useState(defaultStartDate());
  const [modifiedEnd, setModifiedEnd] = useState(defaultEndDate());
  const [status, setStatus] = useState("");
  const [soId, setSoId] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(30);

  // ─── Data State ────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queried, setQueried] = useState(false);

  // ─── Fetch Orders ──────────────────────────────────────────────────────────
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold">
              聚
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                聚水潭订单管理
              </h1>
              <p className="text-xs text-zinc-500">
                /open/orders/single/query
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-zinc-300">查询条件</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 修改起始时间 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                修改起始时间
              </label>
              <input
                type="datetime-local"
                value={modifiedBegin}
                onChange={(e) => setModifiedBegin(e.target.value)}
                className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25"
              />
            </div>

            {/* 修改结束时间 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                修改结束时间
              </label>
              <input
                type="datetime-local"
                value={modifiedEnd}
                onChange={(e) => setModifiedEnd(e.target.value)}
                className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25"
              />
            </div>

            {/* 订单状态 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                订单状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 线上订单号 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                线上订单号（逗号分隔）
              </label>
              <input
                type="text"
                value={soId}
                onChange={(e) => setSoId(e.target.value)}
                placeholder="例: SO001,SO002"
                className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25"
              />
            </div>
          </div>

          {/* 搜索按钮 */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              时间范围最长 7 天 · 并发上限 5次/秒 · 频率上限 100次/分/店
            </p>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    fill="currentColor"
                    className="opacity-75"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
              {loading ? "查询中…" : "查询订单"}
            </button>
          </div>
        </div>

        {/* ── Error Alert ────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <p className="font-medium text-red-200">查询失败</p>
                <p className="mt-1 text-red-300/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Results Summary ────────────────────────────────────────────── */}
        {queried && !error && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              共 <span className="font-semibold text-zinc-300">{totalCount}</span> 条记录
              {" · "}第 <span className="font-semibold text-zinc-300">{pageIndex}</span> 页
            </p>
          </div>
        )}

        {/* ── Orders Table ───────────────────────────────────────────────── */}
        {queried && orders.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800/60">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60 bg-zinc-900/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      线上单号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      内部单号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      店铺 ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      状态
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      应付金额
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      商品明细
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {orders.map((order, idx) => (
                    <tr
                      key={order.o_id ?? idx}
                      className="transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs text-indigo-300">
                        {order.so_id}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">
                        {order.o_id}
                      </td>
                      <td className="px-4 py-3.5 text-zinc-400">
                        {order.shop_id}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-emerald-400">
                        ¥{order.pay_amount?.toFixed(2) ?? "—"}
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        {order.items?.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.slice(0, 3).map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs text-zinc-400"
                              >
                                <span className="truncate max-w-[180px]">
                                  {item.name}
                                </span>
                                <span className="shrink-0 text-zinc-600">
                                  ×{item.qty}
                                </span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <span className="text-xs text-zinc-600">
                                +{order.items.length - 3} 更多…
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-t border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
              <button
                onClick={() => handlePageChange(pageIndex - 1)}
                disabled={pageIndex <= 1 || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                上一页
              </button>

              <span className="text-xs text-zinc-500">
                第 {pageIndex} 页 · 每页 {pageSize} 条
              </span>

              <button
                onClick={() => handlePageChange(pageIndex + 1)}
                disabled={!hasNext || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                下一页
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────────────── */}
        {queried && orders.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-900/30 py-20">
            <svg
              className="mb-4 h-12 w-12 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-500">暂无订单数据</p>
            <p className="mt-1 text-xs text-zinc-600">
              请调整查询条件后重试
            </p>
          </div>
        )}

        {/* ── Initial Guide ──────────────────────────────────────────────── */}
        {!queried && !error && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-900/20 py-24">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-400">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-zinc-400">
              选择查询条件并点击「查询订单」
            </p>
            <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-zinc-600">
              通过聚水潭开放平台 API 查询订单数据。
              支持按时间范围、订单状态、线上单号等条件筛选。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
