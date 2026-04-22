import { NextResponse } from "next/server";

import { fetchGatewayStatus } from "@/app/api/plc/_lib/gateway-client";

export const runtime = "nodejs";

export async function GET() {
  const response = await fetchGatewayStatus();
  return NextResponse.json(response.body, { status: response.status });
}
