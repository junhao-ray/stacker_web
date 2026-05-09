import { NextResponse } from "next/server";

import { RackConfigValidationError, normalizeRackConfig } from "@/lib/rack-config";
import {
  readRackConfigFormValue,
  writeRackConfigFormValue,
} from "@/lib/rack-config-file";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readRackConfigFormValue());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const normalized = normalizeRackConfig(body);
    return NextResponse.json(writeRackConfigFormValue(normalized));
  } catch (error) {
    if (error instanceof RackConfigValidationError) {
      return NextResponse.json(
        { error: error.message, errors: error.errors },
        { status: 400 },
      );
    }

    throw error;
  }
}
