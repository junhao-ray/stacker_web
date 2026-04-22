import type { PlcCommandResult } from "@/lib/types";

export class GatewayHttpError extends Error {
  status: number;
  code: string;
  result: PlcCommandResult;

  constructor(message: string, status: number, code: string, result: PlcCommandResult = "transport_error") {
    super(message);
    this.name = "GatewayHttpError";
    this.status = status;
    this.code = code;
    this.result = result;
  }
}
