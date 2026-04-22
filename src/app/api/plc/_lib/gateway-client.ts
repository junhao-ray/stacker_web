import { emptyPlcStatusSnapshot, parsePlcCommandRequest } from "@/lib/plc";
import type { PlcCommandRequest, PlcStatusSnapshot } from "@/lib/types";

export const runtime = "nodejs";

function getGatewayBaseUrl() {
  return process.env.PLC_GATEWAY_BASE_URL ?? "http://127.0.0.1:4010";
}

function getGatewayHeaders() {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (process.env.PLC_GATEWAY_SHARED_KEY) {
    headers.set("X-PLC-Gateway-Key", process.env.PLC_GATEWAY_SHARED_KEY);
  }

  return headers;
}

export async function fetchGatewayStatus(): Promise<{ status: number; body: PlcStatusSnapshot }> {
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/v1/status`, {
      method: "GET",
      headers: getGatewayHeaders(),
      cache: "no-store",
    });

    const body = await response.json() as PlcStatusSnapshot;
    return {
      status: response.status,
      body,
    };
  } catch {
    return {
      status: 503,
      body: {
        ...emptyPlcStatusSnapshot(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

export async function sendGatewayCommand(body: unknown): Promise<{ status: number; body: unknown }> {
  const command = parsePlcCommandRequest(body) satisfies PlcCommandRequest;

  const response = await fetch(`${getGatewayBaseUrl()}/v1/commands`, {
    method: "POST",
    headers: getGatewayHeaders(),
    body: JSON.stringify(command),
    cache: "no-store",
  });

  return {
    status: response.status,
    body: await response.json() as unknown,
  };
}
