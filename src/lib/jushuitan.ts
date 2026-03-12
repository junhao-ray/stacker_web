import crypto from "crypto";

// ─── Configuration ───────────────────────────────────────────────────────────

const JST_APP_KEY = process.env.JST_APP_KEY ?? "";
const JST_APP_SECRET = process.env.JST_APP_SECRET ?? "";
const JST_ACCESS_TOKEN = process.env.JST_ACCESS_TOKEN ?? "";
const JST_BASE_URL =
  process.env.JST_BASE_URL ?? "https://openapi.jushuitan.com";

// ─── Sign Generation ─────────────────────────────────────────────────────────

/**
 * 聚水潭签名算法
 *
 * 1. 收集所有参数（排除 sign），按 key 字母排序
 * 2. 拼接为 key1value1key2value2...
 * 3. 前置 app_secret
 * 4. MD5 → 32 位小写 hex
 */
export function generateSign(
  params: Record<string, string>,
  appSecret: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort();

  let str = "";
  for (const key of sortedKeys) {
    str += key + params[key];
  }

  str = appSecret + str;

  return crypto.createHash("md5").update(str, "utf-8").digest("hex");
}

// ─── Common Parameter Builder ────────────────────────────────────────────────

/**
 * 构建聚水潭 API 请求所需的全部公共参数（含签名）
 */
export function buildRequestParams(biz: Record<string, unknown>): Record<string, string> {
  const bizStr = JSON.stringify(biz);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params: Record<string, string> = {
    app_key: JST_APP_KEY,
    access_token: JST_ACCESS_TOKEN,
    timestamp,
    version: "2",
    charset: "utf-8",
    biz: bizStr,
  };

  params.sign = generateSign(params, JST_APP_SECRET);

  return params;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderQueryOptions {
  /** 修改起始时间，格式 YYYY-MM-DD HH:MM:SS */
  modified_begin?: string;
  /** 修改结束时间 */
  modified_end?: string;
  /** 线上订单号列表，最多 20 个 */
  so_ids?: string[];
  /** 内部单号列表 */
  o_ids?: number[];
  /** 店铺 ID */
  shop_id?: number;
  /** 订单状态: WaitPay, WaitConfirm, Confirmed, Cancelled, Sent, Delivered 等 */
  status?: string;
  /** 时间类型 0=修改时间 2=下单日期 3=发货日期 */
  date_type?: number;
  /** 页码，从 1 开始 */
  page_index?: number;
  /** 每页条数，默认 100，最大 100 */
  page_size?: number;
  /** 增量同步时间戳 */
  start_ts?: number;
}

export interface OrderItem {
  sku_id: string;
  name: string;
  qty: number;
  price: number;
  amount: number;
  [key: string]: unknown;
}

export interface Order {
  o_id: number;
  so_id: string;
  shop_id: number;
  status: string;
  pay_amount: number;
  receiver_name?: string;
  receiver_mobile?: string;
  items: OrderItem[];
  [key: string]: unknown;
}

export interface OrderQueryResponse {
  code: number;
  msg: string;
  data?: {
    page_index: number;
    page_size: number;
    data_count: number;
    has_next: boolean;
    orders: Order[];
  };
}

// ─── Order Query API ─────────────────────────────────────────────────────────

/**
 * 调用聚水潭订单查询接口
 * POST /open/orders/single/query
 */
export async function queryOrders(
  options: OrderQueryOptions
): Promise<OrderQueryResponse> {
  const biz: Record<string, unknown> = {};

  if (options.modified_begin) biz.modified_begin = options.modified_begin;
  if (options.modified_end) biz.modified_end = options.modified_end;
  if (options.so_ids?.length) biz.so_ids = options.so_ids;
  if (options.o_ids?.length) biz.o_ids = options.o_ids;
  if (options.shop_id) biz.shop_id = options.shop_id;
  if (options.status) biz.status = options.status;
  if (options.date_type !== undefined) biz.date_type = options.date_type;
  if (options.page_index) biz.page_index = options.page_index;
  if (options.page_size) biz.page_size = options.page_size;
  if (options.start_ts !== undefined) biz.start_ts = options.start_ts;

  const params = buildRequestParams(biz);

  // 构建 x-www-form-urlencoded body
  const body = new URLSearchParams(params).toString();

  const url = `${JST_BASE_URL}/open/orders/single/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `JuShuiTan API HTTP error: ${res.status} ${res.statusText}`
    );
  }

  const json: OrderQueryResponse = await res.json();
  return json;
}

// ─── Error Code Descriptions ─────────────────────────────────────────────────

export const JST_ERROR_CODES: Record<number, string> = {
  0: "执行成功",
  10: "签名错误 (sign)",
  100: "access_token 过期或无效",
  110: "IP 地址不在白名单中",
  130: "传输数据不能为空",
  140: "参数不符合规范",
  150: "内部处理异常",
  160: "频控限制（并发/频率超限）",
  170: "店铺编号不存在或未绑定",
  180: "执行失败 (timestamp 差值过大)",
  190: "验证失败（无权限）",
  199: "调用频率超限",
  200: "调用频次过多",
};
