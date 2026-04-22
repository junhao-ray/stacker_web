import http from "node:http";

import { parsePlcCommandRequest, PlcRequestValidationError } from "@/lib/plc";

import { GatewayHttpError } from "./errors";
import { PlcGateway } from "./gateway";

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export function createGatewayServer(gateway: PlcGateway) {
  const sharedKey = process.env.PLC_GATEWAY_SHARED_KEY ?? "";

  return http.createServer(async (req, res) => {
    try {
      if (sharedKey && req.headers["x-plc-gateway-key"] !== sharedKey) {
        jsonResponse(res, 401, { code: "unauthorized", message: "共享密钥校验失败" });
        return;
      }

      if (req.method === "GET" && req.url === "/healthz") {
        jsonResponse(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && req.url === "/v1/status") {
        jsonResponse(res, 200, gateway.getStatus());
        return;
      }

      if (req.method === "POST" && req.url === "/v1/commands") {
        const body = await readJsonBody(req);
        const command = parsePlcCommandRequest(body);
        const response = await gateway.execute(command);
        jsonResponse(res, response.status, response.body);
        return;
      }

      jsonResponse(res, 404, { code: "not_found", message: "路由不存在" });
    } catch (error) {
      if (error instanceof PlcRequestValidationError) {
        jsonResponse(res, error.status, {
          code: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof GatewayHttpError) {
        jsonResponse(res, error.status, {
          code: error.code,
          message: error.message,
          status: gateway.getStatus(),
        });
        return;
      }

      console.error("[opc-gateway] unhandled error", error);
      jsonResponse(res, 500, {
        code: "internal_error",
        message: error instanceof Error ? error.message : "未知错误",
      });
    }
  });
}
