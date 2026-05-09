export const SIMULATOR_COMMAND_CODES = {
  pickToBin: 100,
  releaseBin: 110,
  pause: 120,
  resume: 130,
  home: 140,
  resetAlarm: 150,
} as const;

export const SIMULATOR_MACHINE_STATE = {
  idle: 0,
  running: 1,
  paused: 2,
  alarm: 3,
  homing: 4,
  manual: 5,
} as const;

export const SIMULATOR_MOTION_PHASE = {
  none: 0,
  safetyCheck: 10,
  moveToPick: 20,
  waitInPosition: 30,
  extend: 40,
  vacuumOn: 50,
  vacuumCheck: 60,
  retract: 70,
  moveToBin: 80,
  release: 90,
  done: 100,
  error: 900,
} as const;

export type SimulatorAction = "pickToBin" | "releaseBin" | "home" | null;

export type SimulatorCommandResult = {
  accepted: boolean;
  result: string;
  action: SimulatorAction;
};

export type SimulatorState = {
  Cmd_Seq: number;
  Cmd_Code: number;
  Cmd_Trigger: boolean;
  Target_X: number;
  Target_Y: number;
  Target_Side: number;
  Target_Qty: number;
  Trace_TaskNo: string;
  Trace_OrderNo: string;
  Trace_StepId: string;
  Trace_ProductCode: string;
  Trace_SlotId: string;
  Ack_Seq: number;
  Ack_Code: number;
  Ack_Result: string;
  Machine_State: number;
  Step_Busy: boolean;
  Step_Done: boolean;
  Current_Seq: number;
  Current_StepId: string;
  Actual_X: number;
  Actual_Y: number;
  Alarm: boolean;
  ErrorCode: string;
  ErrorMessage: string;
  Heartbeat: number;
  Motion_Phase: number;
  Vacuum_On: boolean;
  Vacuum_OK: boolean;
  Cylinder_Extended: boolean;
  Cylinder_Retracted: boolean;
  AxisX_InPosition: boolean;
  AxisY_InPosition: boolean;
  Safety_OK: boolean;
  Door_Closed: boolean;
  EStop_OK: boolean;
};

export function createSimulatorState(): SimulatorState {
  return {
    Cmd_Seq: 0,
    Cmd_Code: 0,
    Cmd_Trigger: false,
    Target_X: 0,
    Target_Y: 0,
    Target_Side: 0,
    Target_Qty: 1,
    Trace_TaskNo: "",
    Trace_OrderNo: "",
    Trace_StepId: "",
    Trace_ProductCode: "",
    Trace_SlotId: "",
    Ack_Seq: 0,
    Ack_Code: 0,
    Ack_Result: "",
    Machine_State: SIMULATOR_MACHINE_STATE.idle,
    Step_Busy: false,
    Step_Done: false,
    Current_Seq: 0,
    Current_StepId: "",
    Actual_X: 0,
    Actual_Y: 0,
    Alarm: false,
    ErrorCode: "",
    ErrorMessage: "",
    Heartbeat: 0,
    Motion_Phase: SIMULATOR_MOTION_PHASE.none,
    Vacuum_On: false,
    Vacuum_OK: true,
    Cylinder_Extended: false,
    Cylinder_Retracted: true,
    AxisX_InPosition: true,
    AxisY_InPosition: true,
    Safety_OK: true,
    Door_Closed: true,
    EStop_OK: true,
  };
}

export class StackerSimulatorRuntime {
  readonly state = createSimulatorState();

  setValue(name: keyof SimulatorState, value: string | number | boolean) {
    const currentValue = this.state[name];
    if (typeof currentValue === "number") {
      (this.state[name] as number) = Number(value) || 0;
      return;
    }
    if (typeof currentValue === "boolean") {
      (this.state[name] as boolean) = Boolean(value);
      return;
    }
    (this.state[name] as string) = String(value ?? "");
  }

  pulseTrigger(next: boolean): SimulatorCommandResult | null {
    const risingEdge = next && !this.state.Cmd_Trigger;
    this.state.Cmd_Trigger = next;
    return risingEdge ? this.handleCommand() : null;
  }

  tickHeartbeat() {
    this.state.Heartbeat = this.state.Heartbeat >= 999_999 ? 1 : this.state.Heartbeat + 1;
  }

  completeCurrentAction() {
    if (!this.state.Step_Busy) return;

    this.state.Actual_X = this.state.Target_X;
    this.state.Actual_Y = this.state.Target_Y;
    this.state.Step_Busy = false;
    this.state.Step_Done = true;
    this.state.Machine_State = SIMULATOR_MACHINE_STATE.idle;
    this.state.Motion_Phase = SIMULATOR_MOTION_PHASE.done;
    this.state.Vacuum_On = false;
    this.state.Cylinder_Extended = false;
    this.state.Cylinder_Retracted = true;
    this.state.AxisX_InPosition = true;
    this.state.AxisY_InPosition = true;
  }

  setMotionPhase(phase: number) {
    this.state.Motion_Phase = phase;
    this.state.Vacuum_On = phase >= SIMULATOR_MOTION_PHASE.vacuumOn && phase < SIMULATOR_MOTION_PHASE.release;
    this.state.Cylinder_Extended = phase >= SIMULATOR_MOTION_PHASE.extend && phase < SIMULATOR_MOTION_PHASE.retract;
    this.state.Cylinder_Retracted = !this.state.Cylinder_Extended;
    this.state.AxisX_InPosition = phase >= SIMULATOR_MOTION_PHASE.waitInPosition;
    this.state.AxisY_InPosition = phase >= SIMULATOR_MOTION_PHASE.waitInPosition;
  }

  private handleCommand(): SimulatorCommandResult {
    const code = this.state.Cmd_Code;

    if (this.state.Alarm && code !== SIMULATOR_COMMAND_CODES.resetAlarm) {
      return this.reject("alarm", "PLC_ALARM", "Simulator is in alarm state.");
    }

    switch (code) {
      case SIMULATOR_COMMAND_CODES.pickToBin:
        return this.startPickToBin();
      case SIMULATOR_COMMAND_CODES.releaseBin:
        return this.startAction("ok", "releaseBin");
      case SIMULATOR_COMMAND_CODES.home:
        return this.startAction("ok", "home");
      case SIMULATOR_COMMAND_CODES.pause:
        return this.pause();
      case SIMULATOR_COMMAND_CODES.resume:
        return this.resume();
      case SIMULATOR_COMMAND_CODES.resetAlarm:
        return this.resetAlarm();
      default:
        return this.reject("rejected", "UNKNOWN_COMMAND", `Unsupported command code ${code}.`);
    }
  }

  private startPickToBin(): SimulatorCommandResult {
    if (!Number.isFinite(this.state.Target_X) || !Number.isFinite(this.state.Target_Y)) {
      return this.reject("invalid_target", "TARGET_INVALID", "Target coordinates are not finite.");
    }
    if (this.state.Target_X < 0 || this.state.Target_X > 1200 || this.state.Target_Y < 0 || this.state.Target_Y > 1000) {
      return this.reject("invalid_target", "TARGET_OUT_OF_RANGE", "Target coordinates are outside simulator limits.");
    }
    if (!this.state.Trace_StepId) {
      return this.reject("rejected", "STEP_ID_REQUIRED", "Trace_StepId is required.");
    }
    return this.startAction("ok", "pickToBin");
  }

  private startAction(result: string, action: Exclude<SimulatorAction, null>): SimulatorCommandResult {
    if (this.state.Step_Busy || this.state.Machine_State === SIMULATOR_MACHINE_STATE.running) {
      return this.reject("busy", "PLC_BUSY", "Simulator is already running.");
    }

    this.state.Current_Seq = this.state.Cmd_Seq;
    this.state.Current_StepId = this.state.Trace_StepId;
    this.state.Step_Busy = true;
    this.state.Step_Done = false;
    this.state.Machine_State = action === "home" ? SIMULATOR_MACHINE_STATE.homing : SIMULATOR_MACHINE_STATE.running;
    this.state.ErrorCode = "";
    this.state.ErrorMessage = "";
    this.state.Motion_Phase = action === "pickToBin"
      ? SIMULATOR_MOTION_PHASE.safetyCheck
      : SIMULATOR_MOTION_PHASE.moveToBin;
    this.ack(result);

    return {
      accepted: true,
      result,
      action,
    };
  }

  private pause(): SimulatorCommandResult {
    if (!this.state.Step_Busy || this.state.Machine_State !== SIMULATOR_MACHINE_STATE.running) {
      return this.reject("rejected", "INVALID_STATE", "Pause requires a running action.");
    }
    this.state.Machine_State = SIMULATOR_MACHINE_STATE.paused;
    this.ack("ok");
    return { accepted: true, result: "ok", action: null };
  }

  private resume(): SimulatorCommandResult {
    if (!this.state.Step_Busy || this.state.Machine_State !== SIMULATOR_MACHINE_STATE.paused) {
      return this.reject("rejected", "INVALID_STATE", "Resume requires a paused action.");
    }
    this.state.Machine_State = SIMULATOR_MACHINE_STATE.running;
    this.ack("ok");
    return { accepted: true, result: "ok", action: null };
  }

  private resetAlarm(): SimulatorCommandResult {
    this.state.Alarm = false;
    this.state.ErrorCode = "";
    this.state.ErrorMessage = "";
    this.state.Step_Busy = false;
    this.state.Step_Done = false;
    this.state.Machine_State = SIMULATOR_MACHINE_STATE.idle;
    this.state.Motion_Phase = SIMULATOR_MOTION_PHASE.none;
    this.ack("ok");
    return { accepted: true, result: "ok", action: null };
  }

  private reject(result: string, errorCode: string, errorMessage: string): SimulatorCommandResult {
    this.state.ErrorCode = errorCode;
    this.state.ErrorMessage = errorMessage;
    this.state.Motion_Phase = SIMULATOR_MOTION_PHASE.error;
    this.ack(result);
    return {
      accepted: false,
      result,
      action: null,
    };
  }

  private ack(result: string) {
    this.state.Ack_Seq = this.state.Cmd_Seq;
    this.state.Ack_Code = this.state.Cmd_Code;
    this.state.Ack_Result = result;
  }
}
