export type OpcDebugDataType = "BOOL" | "INT" | "REAL";

export type OpcDebugAccess = "read" | "write" | "readwrite";

export type OpcDebugVariable = {
  name: string;
  dataType: OpcDebugDataType;
  access: OpcDebugAccess;
  role: "command" | "parameter" | "timing" | "status";
};

export const OPC_DEBUG_TIMING_FIELDS = [
  { name: "OPC_T_RotateMs", label: "Rotate to left/right", defaultValue: 500 },
  { name: "OPC_T_ExtendMs", label: "Line extend + vacuum", defaultValue: 700 },
  { name: "OPC_T_RetractMs", label: "Line retract", defaultValue: 700 },
  { name: "OPC_T_CenterMs", label: "Return to center", defaultValue: 500 },
  { name: "OPC_T_BlowMs", label: "Blow off", defaultValue: 300 },
  { name: "OPC_T_FlipMs", label: "Unload flip", defaultValue: 800 },
  { name: "OPC_T_FlipBackMs", label: "Unload flip back", defaultValue: 800 },
] as const;

export const OPC_DEBUG_VARIABLES: OpcDebugVariable[] = [
  { name: "OPC_CmdReq", dataType: "BOOL", access: "readwrite", role: "command" },
  { name: "OPC_CmdAck", dataType: "BOOL", access: "read", role: "status" },
  { name: "OPC_CmdDone", dataType: "BOOL", access: "read", role: "status" },
  { name: "OPC_CmdError", dataType: "BOOL", access: "read", role: "status" },
  { name: "OPC_CmdCode", dataType: "INT", access: "readwrite", role: "command" },
  { name: "OPC_ErrorID", dataType: "INT", access: "read", role: "status" },
  { name: "OPC_State", dataType: "INT", access: "read", role: "status" },
  { name: "OPC_TargetX", dataType: "REAL", access: "readwrite", role: "parameter" },
  { name: "OPC_TargetZ", dataType: "REAL", access: "readwrite", role: "parameter" },
  { name: "OPC_PickQty", dataType: "INT", access: "readwrite", role: "parameter" },
  { name: "OPC_PickDir", dataType: "INT", access: "readwrite", role: "parameter" },
  ...OPC_DEBUG_TIMING_FIELDS.map((field) => ({
    name: field.name,
    dataType: "INT" as const,
    access: "readwrite" as const,
    role: "timing" as const,
  })),
  { name: "OPC_ServoOn", dataType: "BOOL", access: "readwrite", role: "command" },
  { name: "OPC_Busy", dataType: "BOOL", access: "read", role: "status" },
  { name: "OPC_Ready", dataType: "BOOL", access: "read", role: "status" },
  { name: "OPC_X_ActualPos", dataType: "REAL", access: "read", role: "status" },
  { name: "OPC_Z_ActualPos", dataType: "REAL", access: "read", role: "status" },
];

export const OPC_DEBUG_COMMAND_PRESETS = [
  { label: "Pick", code: 1, description: "抓取：使用 TargetX / TargetZ / PickQty / PickDir" },
  { label: "Unload", code: 2, description: "卸料：回到 0,0 后翻转卸料" },
  { label: "Home", code: 3, description: "回零：X/Z 两轴回 Home" },
  { label: "Stop", code: 4, description: "停止：停止轴运动并清空流程" },
  { label: "Reset", code: 5, description: "复位：轴 ErrorStop 后执行 MC_Reset" },
  { label: "Immediate Stop", code: 9, description: "急停：执行 MC_ImmediateStop" },
] as const;

export function getOpcDebugVariable(name: string) {
  return OPC_DEBUG_VARIABLES.find((variable) => variable.name === name);
}

export function buildOpcNodeId(name: string, prefix: string, suffix: string) {
  return `${prefix}${name}${suffix}`;
}
