import { describe, expect, it } from "vitest";

import {
  SIMULATOR_COMMAND_CODES,
  SIMULATOR_MACHINE_STATE,
  StackerSimulatorRuntime,
} from "../services/opc-simulator/src/simulator-core";

function preparePick(runtime: StackerSimulatorRuntime) {
  runtime.setValue("Cmd_Seq", 1);
  runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.pickToBin);
  runtime.setValue("Target_X", 133);
  runtime.setValue("Target_Y", 111);
  runtime.setValue("Target_Side", 1);
  runtime.setValue("Target_Qty", 1);
  runtime.setValue("Trace_TaskNo", "TASK-1");
  runtime.setValue("Trace_OrderNo", "ORDER-1");
  runtime.setValue("Trace_StepId", "STEP-1");
  runtime.setValue("Trace_ProductCode", "SKU-1");
  runtime.setValue("Trace_SlotId", "left-01-01");
}

describe("StackerSimulatorRuntime", () => {
  it("accepts and completes PickToBin", () => {
    const runtime = new StackerSimulatorRuntime();
    preparePick(runtime);

    const result = runtime.pulseTrigger(true);
    runtime.pulseTrigger(false);

    expect(result).toMatchObject({ accepted: true, result: "ok", action: "pickToBin" });
    expect(runtime.state.Ack_Seq).toBe(1);
    expect(runtime.state.Step_Busy).toBe(true);

    runtime.completeCurrentAction();

    expect(runtime.state.Step_Busy).toBe(false);
    expect(runtime.state.Step_Done).toBe(true);
    expect(runtime.state.Actual_X).toBe(133);
    expect(runtime.state.Actual_Y).toBe(111);
    expect(runtime.state.Machine_State).toBe(SIMULATOR_MACHINE_STATE.idle);
  });

  it("rejects a new PickToBin while busy", () => {
    const runtime = new StackerSimulatorRuntime();
    preparePick(runtime);
    runtime.pulseTrigger(true);
    runtime.pulseTrigger(false);

    runtime.setValue("Cmd_Seq", 2);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.pickToBin);
    const result = runtime.pulseTrigger(true);

    expect(result).toMatchObject({ accepted: false, result: "busy" });
    expect(runtime.state.ErrorCode).toBe("PLC_BUSY");
  });

  it("rejects out-of-range targets", () => {
    const runtime = new StackerSimulatorRuntime();
    preparePick(runtime);
    runtime.setValue("Target_X", 1201);

    const result = runtime.pulseTrigger(true);

    expect(result).toMatchObject({ accepted: false, result: "invalid_target" });
    expect(runtime.state.ErrorCode).toBe("TARGET_OUT_OF_RANGE");
  });

  it("pauses, resumes, homes, releases, and resets alarm", () => {
    const runtime = new StackerSimulatorRuntime();
    preparePick(runtime);
    runtime.pulseTrigger(true);
    runtime.pulseTrigger(false);

    runtime.setValue("Cmd_Seq", 2);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.pause);
    expect(runtime.pulseTrigger(true)).toMatchObject({ accepted: true, result: "ok" });
    runtime.pulseTrigger(false);
    expect(runtime.state.Machine_State).toBe(SIMULATOR_MACHINE_STATE.paused);

    runtime.setValue("Cmd_Seq", 3);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.resume);
    expect(runtime.pulseTrigger(true)).toMatchObject({ accepted: true, result: "ok" });
    runtime.pulseTrigger(false);
    expect(runtime.state.Machine_State).toBe(SIMULATOR_MACHINE_STATE.running);

    runtime.completeCurrentAction();
    runtime.setValue("Cmd_Seq", 4);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.releaseBin);
    expect(runtime.pulseTrigger(true)).toMatchObject({ accepted: true, action: "releaseBin" });
    runtime.pulseTrigger(false);
    runtime.completeCurrentAction();
    expect(runtime.state.Step_Done).toBe(true);

    runtime.setValue("Cmd_Seq", 5);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.home);
    expect(runtime.pulseTrigger(true)).toMatchObject({ accepted: true, action: "home" });
    runtime.pulseTrigger(false);

    runtime.setValue("Alarm", true);
    runtime.setValue("Cmd_Seq", 6);
    runtime.setValue("Cmd_Code", SIMULATOR_COMMAND_CODES.resetAlarm);
    expect(runtime.pulseTrigger(true)).toMatchObject({ accepted: true, result: "ok" });
    expect(runtime.state.Alarm).toBe(false);
  });
});
