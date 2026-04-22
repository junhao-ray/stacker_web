import type {
  PlcCommand,
  PlcLastCommand,
  PlcMachineState,
  PlcStatusSnapshot,
} from "@/lib/types";

import { GatewayHttpError } from "./errors";
import { buildStatusSnapshot, createLastCommand } from "./status";
import type {
  GatewayCommandRequest,
  GatewayConfig,
  GatewayCommandResponse,
  PlcTransport,
} from "./types";

function createRequestId() {
  return `plc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class PlcGateway {
  private inFlight = false;
  private lastCommand: PlcLastCommand | null = null;
  private seq = 0;

  constructor(
    private readonly config: GatewayConfig,
    private readonly transport: PlcTransport,
  ) {}

  async start() {
    await this.transport.start();
  }

  async stop() {
    await this.transport.stop();
  }

  getStatus(): PlcStatusSnapshot {
    return buildStatusSnapshot(this.transport.getStatus(), this.inFlight, this.lastCommand);
  }

  async execute(request: GatewayCommandRequest): Promise<GatewayCommandResponse> {
    const transportStatus = this.transport.getStatus();

    if (!transportStatus.configured || !transportStatus.connected) {
      throw new GatewayHttpError("PLC 网关未配置或 OPC UA 未连接", 503, "gateway_unavailable", "transport_error");
    }

    if (this.inFlight) {
      throw new GatewayHttpError("已有命令正在执行中", 409, "command_in_flight", "transport_error");
    }

    this.assertCommandAllowed(
      request.command,
      transportStatus.snapshot.machineState,
      transportStatus.snapshot.currentTaskNo,
      transportStatus.snapshot.alarm,
      request.task?.taskNo ?? null,
    );

    this.inFlight = true;
    const requestId = createRequestId();
    const seq = this.nextSeq();
    const commandCode = this.config.commandCodes[request.command];
    const taskNo = request.task?.taskNo ?? null;

    try {
      if (request.command === "dispatchTask" && request.task) {
        await this.transport.writeTaskPayload(request.task);
      }

      const lastCommand = await this.transport.sendCommand({
        command: request.command,
        requestId,
        seq,
        commandCode,
        taskNo,
      });

      this.lastCommand = lastCommand;

      return {
        status: 200,
        body: buildStatusSnapshot(this.transport.getStatus(), false, lastCommand),
      };
    } catch (error) {
      const gatewayError = error instanceof GatewayHttpError
        ? error
        : new GatewayHttpError(
            error instanceof Error ? error.message : "PLC 网关内部错误",
            500,
            "gateway_error",
            "transport_error",
          );

      this.lastCommand = createLastCommand(request.command, requestId, taskNo, gatewayError.result, {
        errorCode: gatewayError.code,
        errorMessage: gatewayError.message,
      });

      throw gatewayError;
    } finally {
      this.inFlight = false;
    }
  }

  private nextSeq() {
    this.seq = this.seq >= 999_999 ? 1 : this.seq + 1;
    return this.seq;
  }

  private assertCommandAllowed(
    command: PlcCommand,
    machineState: PlcMachineState,
    currentTaskNo: string | null,
    alarm: boolean,
    requestedTaskNo: string | null,
  ) {
    if (command === "dispatchTask") {
      if (!(machineState === "idle" || machineState === "unknown")) {
        throw new GatewayHttpError("当前设备状态不允许下发任务", 409, "invalid_machine_state", "rejected");
      }
      return;
    }

    if (command === "start") {
      if (alarm || machineState === "alarm") {
        throw new GatewayHttpError("设备处于告警状态，不能开始", 409, "machine_alarm", "rejected");
      }
      if (requestedTaskNo && currentTaskNo !== requestedTaskNo) {
        throw new GatewayHttpError("当前 PLC 任务与页面选中任务不一致", 409, "task_mismatch", "rejected");
      }
      return;
    }

    if (command === "pause" && machineState !== "running") {
      throw new GatewayHttpError("只有运行中才能暂停", 409, "invalid_machine_state", "rejected");
    }

    if (command === "resume" && machineState !== "paused") {
      throw new GatewayHttpError("只有暂停时才能继续", 409, "invalid_machine_state", "rejected");
    }

    if (command === "reset" && machineState === "unknown") {
      throw new GatewayHttpError("当前连接状态未知，不能执行复位", 409, "invalid_machine_state", "rejected");
    }
  }
}
