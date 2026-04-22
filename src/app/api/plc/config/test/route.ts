import { NextRequest, NextResponse } from "next/server";

import { normalizePlcGatewayConfigFormValue } from "@/lib/plc-config-file";
import { testPlcConnectionConfig } from "@/lib/plc-config-test";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const normalized = normalizePlcGatewayConfigFormValue(body);
  const result = await testPlcConnectionConfig(normalized);

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
