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
      throw new GatewayHttpError("PLC gateway is not configured or OPC UA is disconnected", 503, "gateway_unavailable", "transport_error");
    }

    if (this.inFlight) {
      throw new GatewayHttpError("A PLC command is already in flight", 409, "command_in_flight", "transport_error");
    }

    this.assertCommandAllowed(
      request.command,
      transportStatus.snapshot.machineState,
      transportStatus.snapshot.alarm,
      transportStatus.snapshot.stepBusy,
    );

    this.inFlight = true;
    const requestId = createRequestId();
    const seq = this.nextSeq();
    const commandCode = this.config.commandCodes[request.command];

    try {
      const lastCommand = await this.transport.sendCommand({
        command: request.command,
        requestId,
        seq,
        commandCode,
        payload: request.payload,
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
            error instanceof Error ? error.message : "PLC gateway internal error",
            500,
            "gateway_error",
            "transport_error",
          );

      this.lastCommand = createLastCommand(
        request.command,
        requestId,
        request.payload?.taskNo ?? null,
        gatewayError.result,
        {
          stepId: request.payload?.stepId ?? null,
          errorCode: gatewayError.code,
          errorMessage: gatewayError.message,
        },
      );

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
    alarm: boolean,
    stepBusy: boolean,
  ) {
    if (command === "resetAlarm") {
      return;
    }

    if (alarm || machineState === "alarm") {
      throw new GatewayHttpError("PLC is in alarm state", 409, "machine_alarm", "alarm");
    }

    if (command === "pickToBin" || command === "releaseBin" || command === "home") {
      if (stepBusy || machineState === "running" || machineState === "paused") {
        throw new GatewayHttpError("PLC is busy", 409, "plc_busy", "busy");
      }
      return;
    }

    if (command === "pause" && machineState !== "running") {
      throw new GatewayHttpError("Pause requires running state", 409, "invalid_machine_state", "rejected");
    }

    if (command === "resume" && machineState !== "paused") {
      throw new GatewayHttpError("Resume requires paused state", 409, "invalid_machine_state", "rejected");
    }
  }
}
