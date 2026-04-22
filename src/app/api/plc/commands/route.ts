import { NextRequest, NextResponse } from "next/server";

import { PlcRequestValidationError } from "@/lib/plc";
import { sendGatewayCommand } from "@/app/api/plc/_lib/gateway-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await sendGatewayCommand(body);
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    if (error instanceof PlcRequestValidationError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        code: "gateway_proxy_error",
        message: error instanceof Error ? error.message : "PLC 网关代理失败",
      },
      { status: 500 },
    );
  }
}
