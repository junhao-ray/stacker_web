import type { PlcCommandRequest, PlcStatusSnapshot } from "@/lib/types";
import type { PlcGatewayConfigFormValue } from "@/lib/plc-config";

export class PlcApiError extends Error {
  status: number;
  code: string;
  snapshot: PlcStatusSnapshot | null;

  constructor(message: string, status: number, code: string, snapshot: PlcStatusSnapshot | null = null) {
    super(message);
    this.name = "PlcApiError";
    this.status = status;
    this.code = code;
    this.snapshot = snapshot;
  }
}

type ErrorPayload = {
  code?: string;
  message?: string;
  status?: PlcStatusSnapshot;
};

export type PlcConfigPayload = {
  path: string;
  exists: boolean;
  value: PlcGatewayConfigFormValue;
};

export type PlcConnectionTestPayload = {
  ok: boolean;
  endpointUrl: string;
  message: string;
  checkedAt: string;
};

export async function fetchPlcStatusSnapshot(signal?: AbortSignal): Promise<PlcStatusSnapshot> {
  const response = await fetch("/api/plc/status", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const body = await response.json() as PlcStatusSnapshot | ErrorPayload;

  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "获取 PLC 状态失败",
      response.status,
      errorBody.code ?? "plc_status_error",
      errorBody.status ?? null,
    );
  }

  return body as PlcStatusSnapshot;
}

export async function sendPlcCommand(request: PlcCommandRequest): Promise<PlcStatusSnapshot> {
  const response = await fetch("/api/plc/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  const body = await response.json() as PlcStatusSnapshot | ErrorPayload;

  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "PLC 命令执行失败",
      response.status,
      errorBody.code ?? "plc_command_error",
      errorBody.status ?? null,
    );
  }

  return body as PlcStatusSnapshot;
}

export async function fetchPlcConfig(): Promise<PlcConfigPayload> {
  const response = await fetch("/api/plc/config", {
    method: "GET",
    cache: "no-store",
  });

  const body = await response.json() as PlcConfigPayload | ErrorPayload;
  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "读取 PLC 配置失败",
      response.status,
      errorBody.code ?? "plc_config_error",
    );
  }

  return body as PlcConfigPayload;
}

export async function fetchPlcTemplateConfig(): Promise<PlcConfigPayload> {
  const response = await fetch("/api/plc/config?source=template", {
    method: "GET",
    cache: "no-store",
  });

  const body = await response.json() as PlcConfigPayload | ErrorPayload;
  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "读取 PLC 模板配置失败",
      response.status,
      errorBody.code ?? "plc_template_config_error",
    );
  }

  return body as PlcConfigPayload;
}

export async function savePlcConfig(value: PlcGatewayConfigFormValue): Promise<PlcConfigPayload> {
  const response = await fetch("/api/plc/config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
    cache: "no-store",
  });

  const body = await response.json() as PlcConfigPayload | ErrorPayload;
  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "保存 PLC 配置失败",
      response.status,
      errorBody.code ?? "plc_config_save_error",
    );
  }

  return body as PlcConfigPayload;
}

export async function testPlcConfig(value: PlcGatewayConfigFormValue): Promise<PlcConnectionTestPayload> {
  const response = await fetch("/api/plc/config/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
    cache: "no-store",
  });

  const body = await response.json() as PlcConnectionTestPayload | ErrorPayload;
  if (!response.ok) {
    const errorBody = body as ErrorPayload;
    throw new PlcApiError(
      errorBody.message ?? "PLC 配置测试失败",
      response.status,
      errorBody.code ?? "plc_config_test_error",
    );
  }

  return body as PlcConnectionTestPayload;
}
