"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Cable,
  CheckCircle2,
  Download,
  FileCog,
  Gauge,
  Loader2,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clonePlcGatewayConfigFormValue,
  createDefaultPlcGatewayConfigFormValue,
  PLC_SECURITY_MODES,
  PLC_SECURITY_POLICIES,
  type PlcGatewayConfigFormValue,
} from "@/lib/plc-config";
import {
  fetchPlcConfig,
  fetchPlcTemplateConfig,
  savePlcConfig,
  testPlcConfig,
  type PlcConnectionTestPayload,
} from "@/lib/plc-client";

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function NodeInput({
  label,
  meta,
  value,
  onChange,
}: {
  label: string;
  meta?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-4 items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {meta ? <span className="shrink-0 text-[11px] text-muted-foreground/70">{meta}</span> : null}
      </div>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

type NodeField = {
  label: string;
  path: string;
  dataType: string;
};

const COMMAND_NODE_FIELDS: NodeField[] = [
  { label: "Cmd_Seq", path: "nodes.command.seq", dataType: "UInt32" },
  { label: "Cmd_Code", path: "nodes.command.code", dataType: "UInt32" },
  { label: "Cmd_Trigger", path: "nodes.command.trigger", dataType: "Boolean" },
];

const TARGET_NODE_FIELDS: NodeField[] = [
  { label: "Target_X", path: "nodes.target.x", dataType: "Double" },
  { label: "Target_Y", path: "nodes.target.y", dataType: "Double" },
  { label: "Target_Side", path: "nodes.target.side", dataType: "UInt32" },
  { label: "Target_Qty", path: "nodes.target.qty", dataType: "UInt32" },
];

const TRACE_NODE_FIELDS: NodeField[] = [
  { label: "Trace_TaskNo", path: "nodes.trace.taskNo", dataType: "String" },
  { label: "Trace_OrderNo", path: "nodes.trace.orderNo", dataType: "String" },
  { label: "Trace_StepId", path: "nodes.trace.stepId", dataType: "String" },
  { label: "Trace_ProductCode", path: "nodes.trace.productCode", dataType: "String" },
  { label: "Trace_SlotId", path: "nodes.trace.slotId", dataType: "String" },
];

const ACK_NODE_FIELDS: NodeField[] = [
  { label: "Ack_Seq", path: "nodes.ack.seq", dataType: "UInt32" },
  { label: "Ack_Code", path: "nodes.ack.code", dataType: "UInt32" },
  { label: "Ack_Result", path: "nodes.ack.result", dataType: "String" },
];

const MACHINE_NODE_FIELDS: NodeField[] = [
  { label: "Machine_State", path: "nodes.machine.state", dataType: "UInt32" },
  { label: "Step_Busy", path: "nodes.machine.stepBusy", dataType: "Boolean" },
  { label: "Step_Done", path: "nodes.machine.stepDone", dataType: "Boolean" },
  { label: "Current_Seq", path: "nodes.machine.currentSeq", dataType: "UInt32" },
  { label: "Current_StepId", path: "nodes.machine.currentStepId", dataType: "String" },
  { label: "Actual_X", path: "nodes.machine.actualX", dataType: "Double" },
  { label: "Actual_Y", path: "nodes.machine.actualY", dataType: "Double" },
  { label: "Alarm", path: "nodes.machine.alarm", dataType: "Boolean" },
  { label: "ErrorCode", path: "nodes.machine.errorCode", dataType: "String" },
  { label: "ErrorMessage", path: "nodes.machine.errorMessage", dataType: "String" },
];

const DIAGNOSTIC_NODE_FIELDS: NodeField[] = [
  { label: "Heartbeat", path: "nodes.diagnostics.heartbeat", dataType: "UInt32" },
  { label: "Motion_Phase", path: "nodes.diagnostics.motionPhase", dataType: "UInt32" },
  { label: "Vacuum_On", path: "nodes.diagnostics.vacuumOn", dataType: "Boolean" },
  { label: "Vacuum_OK", path: "nodes.diagnostics.vacuumOk", dataType: "Boolean" },
  { label: "Cylinder_Extended", path: "nodes.diagnostics.cylinderExtended", dataType: "Boolean" },
  { label: "Cylinder_Retracted", path: "nodes.diagnostics.cylinderRetracted", dataType: "Boolean" },
  { label: "AxisX_InPosition", path: "nodes.diagnostics.axisXInPosition", dataType: "Boolean" },
  { label: "AxisY_InPosition", path: "nodes.diagnostics.axisYInPosition", dataType: "Boolean" },
  { label: "Safety_OK", path: "nodes.diagnostics.safetyOk", dataType: "Boolean" },
  { label: "Door_Closed", path: "nodes.diagnostics.doorClosed", dataType: "Boolean" },
  { label: "EStop_OK", path: "nodes.diagnostics.estopOk", dataType: "Boolean" },
];

export default function PlcConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [configExists, setConfigExists] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<PlcConnectionTestPayload | null>(null);
  const [form, setForm] = useState<PlcGatewayConfigFormValue>(() => createDefaultPlcGatewayConfigFormValue());

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPlcConfig();
        if (ignore) return;
        setConfigPath(payload.path);
        setConfigExists(payload.exists);
        setForm(clonePlcGatewayConfigFormValue(payload.value));
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "PLC config load failed");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  function updateNumberField(path: string, value: string) {
    const numericValue = Number(value);
    setForm((current) => {
      const next = clonePlcGatewayConfigFormValue(current);
      const keys = path.split(".");
      let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let index = 0; index < keys.length - 1; index += 1) {
        cursor = cursor[keys[index]] as Record<string, unknown>;
      }
      cursor[keys[keys.length - 1]] = Number.isFinite(numericValue) ? numericValue : 0;
      return next;
    });
  }

  function updateStringField(path: string, value: string) {
    setForm((current) => {
      const next = clonePlcGatewayConfigFormValue(current);
      const keys = path.split(".");
      let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let index = 0; index < keys.length - 1; index += 1) {
        cursor = cursor[keys[index]] as Record<string, unknown>;
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  }

  function getStringField(path: string) {
    return String(path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], form) ?? "");
  }

  function renderNodeFields(fields: NodeField[]) {
    return fields.map((field) => (
      <NodeInput
        key={field.path}
        label={field.label}
        meta={field.dataType}
        value={getStringField(field.path)}
        onChange={(value) => updateStringField(field.path, value)}
      />
    ));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = await savePlcConfig(form);
      setConfigPath(payload.path);
      setConfigExists(payload.exists);
      setForm(clonePlcGatewayConfigFormValue(payload.value));
      setMessage("PLC / OPC config saved. Restart the gateway to apply it.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "PLC config save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);
    setError(null);
    setTestResult(null);
    try {
      const result = await testPlcConfig(form);
      setTestResult(result);
      setMessage(result.message);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "PLC config test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleResetToTemplate() {
    try {
      const template = await fetchPlcTemplateConfig();
      setForm(clonePlcGatewayConfigFormValue(template.value));
      setMessage("Template values loaded. They have not been saved yet.");
      setError(null);
      setTestResult(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Template config load failed");
    }
  }

  function handleExportJson() {
    const blob = new Blob([`${JSON.stringify(form, null, 2)}\n`], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "plc-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-3xl border border-border/70 bg-card/80 px-6 py-12 text-sm text-muted-foreground">
          Loading PLC / OPC config...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[linear-gradient(180deg,rgba(241,245,249,0.65),transparent)] p-4 sm:p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),transparent)]">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-6">
        <div className="rounded-[28px] border border-border/70 bg-card/90 px-5 py-5 shadow-sm shadow-slate-950/3 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <Cable className="size-3" />
                  PLC / OPC Config
                </Badge>
                <Badge variant="outline">{configExists ? "Config file exists" : "Using template defaults"}</Badge>
                <Badge variant="outline">36 OPC variables</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">PLC Connection Config</h1>
                <p className="pb-0.5 text-sm text-muted-foreground">
                  OPC UA connection, command code, and NodeId mapping for exposed stacker variables.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Config file: <span className="font-mono text-foreground">{configPath || "--"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleTestConnection} disabled={testing} size="lg" variant="outline" className="gap-2">
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                {testing ? "Testing..." : "Test Config"}
              </Button>
              <Button onClick={handleResetToTemplate} size="lg" variant="outline" className="gap-2">
                <RotateCcw className="size-4" />
                Template
              </Button>
              <Button onClick={handleExportJson} size="lg" variant="outline" className="gap-2">
                <Download className="size-4" />
                Export JSON
              </Button>
              <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving..." : "Save Config"}
              </Button>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>{message}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {testResult ? (
            <div className={testResult.ok
              ? "mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
              : "mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"}>
              <p className="font-medium">{testResult.ok ? "Connection test passed" : "Connection test failed"}</p>
              <p className="mt-1">{testResult.message}</p>
              <p className="mt-2 text-xs opacity-80">Checked at: {new Date(testResult.checkedAt).toLocaleString()}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={Server}
                  title="Connection"
                  description="OPC UA endpoint, security, reconnect, and handshake timing."
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <NodeInput label="Endpoint URL" value={form.endpointUrl} onChange={(value) => updateStringField("endpointUrl", value)} />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Security Mode</label>
                  <Select value={form.securityMode} onValueChange={(value) => updateStringField("securityMode", value ?? "None")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLC_SECURITY_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Security Policy</label>
                  <Select value={form.securityPolicy} onValueChange={(value) => updateStringField("securityPolicy", value ?? "None")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLC_SECURITY_POLICIES.map((policy) => <SelectItem key={policy} value={policy}>{policy}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {[
                  ["Session Timeout (ms)", "requestedSessionTimeoutMs"],
                  ["ACK Timeout (ms)", "ackTimeoutMs"],
                  ["Step Done Timeout (ms)", "stepDoneTimeoutMs"],
                  ["Reconnect Interval (ms)", "reconnectIntervalMs"],
                  ["Pulse Duration (ms)", "pulseDurationMs"],
                  ["Poll Interval (ms)", "pollIntervalMs"],
                ].map(([label, path]) => (
                  <div key={path} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <Input type="number" value={String(form[path as keyof PlcGatewayConfigFormValue])} onChange={(event) => updateNumberField(path, event.target.value)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={ShieldCheck}
                  title="Command Codes"
                  description="Business command names mapped to PLC command codes."
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  ["Left Side", "sideMapping.left"],
                  ["Right Side", "sideMapping.right"],
                  ["PickToBin", "commandCodes.pickToBin"],
                  ["ReleaseBin", "commandCodes.releaseBin"],
                  ["Pause", "commandCodes.pause"],
                  ["Resume", "commandCodes.resume"],
                  ["Home", "commandCodes.home"],
                  ["ResetAlarm", "commandCodes.resetAlarm"],
                ].map(([label, path]) => (
                  <div key={path} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <Input type="number" value={String(path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], form))} onChange={(event) => updateNumberField(path, event.target.value)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={FileCog}
                  title="Command, Target, and Trace NodeIds"
                  description="Web -> PLC variables written before the command trigger pulse."
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {renderNodeFields(COMMAND_NODE_FIELDS)}
                {renderNodeFields(TARGET_NODE_FIELDS)}
                {renderNodeFields(TRACE_NODE_FIELDS)}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={Gauge}
                  title="ACK and Status NodeIds"
                  description="PLC -> Web acknowledgement, machine state, position, alarm, and error variables."
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {renderNodeFields(ACK_NODE_FIELDS)}
                {renderNodeFields(MACHINE_NODE_FIELDS)}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={Activity}
                  title="Runtime Diagnostics NodeIds"
                  description="PLC -> Web heartbeat, motion phase, actuator state, axis position, and safety interlocks."
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {renderNodeFields(DIAGNOSTIC_NODE_FIELDS)}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
