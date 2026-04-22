import { NextRequest, NextResponse } from "next/server";

import {
  normalizePlcGatewayConfigFormValue,
  readPlcGatewayConfigFormValue,
  readPlcTemplateGatewayConfigFormValue,
  writePlcGatewayConfigFormValue,
} from "@/lib/plc-config-file";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");
  const result = source === "template"
    ? readPlcTemplateGatewayConfigFormValue()
    : readPlcGatewayConfigFormValue();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const normalized = normalizePlcGatewayConfigFormValue(body);
  const result = writePlcGatewayConfigFormValue(normalized);
  return NextResponse.json(result);
}
