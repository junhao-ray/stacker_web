import { NextRequest, NextResponse } from "next/server";
import { queryOrders, JST_ERROR_CODES, type OrderQueryOptions } from "@/lib/jushuitan";

export async function POST(request: NextRequest) {
  try {
    const body: OrderQueryOptions = await request.json();

    // 基本验证
    if (!process.env.JST_APP_KEY || !process.env.JST_APP_SECRET || !process.env.JST_ACCESS_TOKEN) {
      return NextResponse.json(
        {
          code: -1,
          msg: "聚水潭 API 凭据未配置，请检查 .env.local 文件",
        },
        { status: 500 }
      );
    }

    const result = await queryOrders({
      page_index: body.page_index ?? 1,
      page_size: body.page_size ?? 30,
      ...body,
    });

    // 检查聚水潭业务错误码
    if (result.code !== 0) {
      const errorDesc = JST_ERROR_CODES[result.code] ?? "未知错误";
      return NextResponse.json(
        {
          code: result.code,
          msg: `${result.msg} — ${errorDesc}`,
          data: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[JST API] Order query failed:", error);
    return NextResponse.json(
      {
        code: -1,
        msg: error instanceof Error ? error.message : "服务器内部错误",
        data: null,
      },
      { status: 500 }
    );
  }
}
