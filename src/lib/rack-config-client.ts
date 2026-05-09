import type { TwinRackConfig } from "@/lib/types";

export interface RackConfigPayload {
  path: string;
  exists: boolean;
  value: TwinRackConfig;
}

export class RackConfigApiError extends Error {
  status: number;
  errors: string[];

  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.name = "RackConfigApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function parseResponse(response: Response): Promise<RackConfigPayload> {
  const payload = await response.json();

  if (!response.ok) {
    throw new RackConfigApiError(
      typeof payload.error === "string" ? payload.error : "Rack config request failed",
      response.status,
      Array.isArray(payload.errors) ? payload.errors : [],
    );
  }

  return payload as RackConfigPayload;
}

export async function fetchRackConfig() {
  const response = await fetch("/api/rack-config", { cache: "no-store" });
  return parseResponse(response);
}

export async function saveRackConfig(config: TwinRackConfig) {
  const response = await fetch("/api/rack-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  return parseResponse(response);
}
