"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Gauge,
  Loader2,
  Play,
  Power,
  RefreshCcw,
  RotateCcw,
  Send,
  Square,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  OPC_DEBUG_COMMAND_PRESETS,
  OPC_DEBUG_TIMING_FIELDS,
  OPC_DEBUG_VARIABLES,
  type OpcDebugVariable,
} from "@/lib/opc-debug";

type DebugVariableValue = OpcDebugVariable & {
  nodeId: string;
  ok: boolean;
  status: string;
  value: unknown;
};

type DebugPayload = {
  endpointUrl: string;
  prefix: string;
  suffix: string;
  variables: DebugVariableValue[];
  checkedAt: string;
};

type DebugErrorPayload = {
  code?: string;
  message?: string;
  endpointUrl?: string;
};

const LEGACY_DEFAULT_PREFIX = "ns=4;s=";
const DEFAULT_PREFIX = "ns=4;s=变量表|";
const DEFAULT_SUFFIX = "";

function boolText(value: unknown) {
  return value ? "ON" : "OFF";
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "boolean") return boolText(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}

function statusTone(value: unknown) {
  return value ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300" : "border-border/70 bg-card/90";
}

function getStored(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored || stored === LEGACY_DEFAULT_PREFIX) return fallback;
  return stored;
}

export default function PlcDebugPage() {
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [suffix, setSuffix] = useState(DEFAULT_SUFFIX);
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetX, setTargetX] = useState("0");
  const [targetZ, setTargetZ] = useState("0");
  const [pickQty, setPickQty] = useState("1");
  const [pickDir, setPickDir] = useState("1");
  const [customCode, setCustomCode] = useState("1");
  const [pulseMs, setPulseMs] = useState("250");
  const [timingDirty, setTimingDirty] = useState(false);
  const [timingValues, setTimingValues] = useState<Record<string, string>>(() => {
    return Object.fromEntries(OPC_DEBUG_TIMING_FIELDS.map((field) => [field.name, String(field.defaultValue)]));
  });

  useEffect(() => {
    setPrefix(getStored("stacker.opcDebug.prefix", DEFAULT_PREFIX));
    setSuffix(getStored("stacker.opcDebug.suffix", DEFAULT_SUFFIX));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("stacker.opcDebug.prefix", prefix);
    window.localStorage.setItem("stacker.opcDebug.suffix", suffix);
  }, [prefix, suffix]);

  const variables = useMemo(() => payload?.variables ?? [], [payload?.variables]);
  const byName = useMemo(() => {
    return Object.fromEntries(variables.map((variable) => [variable.name, variable])) as Record<string, DebugVariableValue | undefined>;
  }, [variables]);

  const commandVariables = variables.filter((variable) => variable.role === "command");
  const parameterVariables = variables.filter((variable) => variable.role === "parameter");
  const timingVariables = variables.filter((variable) => variable.role === "timing");
  const statusVariables = variables.filter((variable) => variable.role === "status");

  useEffect(() => {
    if (timingDirty) return;

    setTimingValues((current) => {
      const next = { ...current };
      for (const field of OPC_DEBUG_TIMING_FIELDS) {
        const value = byName[field.name]?.value;
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          next[field.name] = String(Math.round(value));
        }
      }
      return next;
    });
  }, [byName, timingDirty]);

  const requestDebug = useCallback(async (options: RequestInit & { url?: string } = {}) => {
    const query = new URLSearchParams({ prefix, suffix });
    const response = await fetch(options.url ?? `/api/plc/debug?${query.toString()}`, {
      cache: "no-store",
      ...options,
    });
    const body = await response.json() as DebugPayload | DebugErrorPayload;
    if (!response.ok) {
      throw new Error((body as DebugErrorPayload).message ?? "OPC debug request failed");
    }
    setPayload(body as DebugPayload);
    return body as DebugPayload;
  }, [prefix, suffix]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setMessage(null);
      setError(null);
    }
    try {
      await requestDebug();
    } catch (refreshError) {
      if (!silent) {
        setError(refreshError instanceof Error ? refreshError.message : "读取 OPC 变量失败");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [requestDebug]);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refresh(true);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  async function writeVariables(label: string, writes: Record<string, unknown>) {
    setWriting(label);
    setMessage(null);
    setError(null);
    try {
      await requestDebug({
        url: "/api/plc/debug",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, suffix, writes }),
      });
      setMessage(`${label} 已写入`);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : `${label} 写入失败`);
    } finally {
      setWriting(null);
    }
  }

  async function writeTimings() {
    const writes = Object.fromEntries(
      OPC_DEBUG_TIMING_FIELDS.map((field) => [field.name, Number(timingValues[field.name]) || field.defaultValue]),
    );
    setWriting("Action intervals");
    setMessage(null);
    setError(null);
    try {
      await requestDebug({
        url: "/api/plc/debug",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, suffix, writes }),
      });
      setMessage("Action intervals written");
      setTimingDirty(false);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Action intervals write failed");
    } finally {
      setWriting(null);
    }
  }

  function resetTimingDefaults() {
    setTimingDirty(true);
    setTimingValues(Object.fromEntries(OPC_DEBUG_TIMING_FIELDS.map((field) => [field.name, String(field.defaultValue)])));
  }

  async function pulseCommand(label: string, commandCode: number) {
    setWriting(label);
    setMessage(null);
    setError(null);
    try {
      await requestDebug({
        url: "/api/plc/debug",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          suffix,
          pulse: {
            commandCode,
            targetX,
            targetZ,
            pickQty,
            pickDir,
            pulseMs,
          },
        }),
      });
      setMessage(`${label} 命令已触发`);
    } catch (pulseError) {
      setError(pulseError instanceof Error ? pulseError.message : `${label} 命令失败`);
    } finally {
      setWriting(null);
    }
  }

  function renderValueCard(name: string, label = name) {
    const variable = byName[name];
    return (
      <div className={`rounded-lg border px-3 py-2 ${statusTone(variable?.value)}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Badge variant={variable?.ok ? "outline" : "destructive"}>{variable?.status ?? "--"}</Badge>
        </div>
        <p className="mt-1 font-mono text-lg font-semibold">{valueText(variable?.value)}</p>
      </div>
    );
  }

  function renderVariableTable(items: DebugVariableValue[]) {
    return (
      <div className="overflow-hidden rounded-lg border border-border/70">
        <div className="grid grid-cols-[1.1fr_0.7fr_1fr_1.5fr] bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>变量</span>
          <span>类型</span>
          <span>当前值</span>
          <span>NodeId</span>
        </div>
        {items.map((variable) => (
          <div key={variable.name} className="grid grid-cols-[1.1fr_0.7fr_1fr_1.5fr] items-center gap-2 border-t border-border/70 px-3 py-2 text-sm">
            <span className="font-medium">{variable.name}</span>
            <span className="text-muted-foreground">{variable.dataType}</span>
            <span className={variable.ok ? "font-mono" : "text-red-600"}>{variable.ok ? valueText(variable.value) : variable.status}</span>
            <span className="truncate font-mono text-xs text-muted-foreground" title={variable.nodeId}>{variable.nodeId}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[linear-gradient(180deg,rgba(241,245,249,0.65),transparent)] p-4 sm:p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),transparent)]">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-5">
        <div className="rounded-[28px] border border-border/70 bg-card/90 px-5 py-5 shadow-sm shadow-slate-950/3 backdrop-blur-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 bg-sky-500/12 text-sky-700 dark:text-sky-300">
                  <Bug className="size-3" />
                  OPC Debug
                </Badge>
                <Badge variant="outline">{OPC_DEBUG_VARIABLES.length} public variables</Badge>
                <Badge variant={autoRefresh ? "secondary" : "outline"}>{autoRefresh ? "Auto refresh" : "Manual refresh"}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">PLC Manual Debug</h1>
                <p className="pb-0.5 text-sm text-muted-foreground">Direct controls for the public OPC command interface.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Endpoint: <span className="font-mono text-foreground">{payload?.endpointUrl ?? "--"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setAutoRefresh((value) => !value)} size="lg" variant="outline" className="gap-2">
                {autoRefresh ? <Square className="size-4" /> : <Play className="size-4" />}
                {autoRefresh ? "Pause Polling" : "Start Polling"}
              </Button>
              <Button onClick={() => refresh()} disabled={loading} size="lg" variant="outline" className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                Refresh
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
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.35fr)]">
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Live Status</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {renderValueCard("OPC_Ready", "Ready")}
                {renderValueCard("OPC_Busy", "Busy")}
                {renderValueCard("OPC_CmdAck", "Ack")}
                {renderValueCard("OPC_CmdDone", "Done")}
                {renderValueCard("OPC_CmdError", "Error")}
                {renderValueCard("OPC_State", "State")}
                {renderValueCard("OPC_ErrorID", "Error ID")}
                {renderValueCard("OPC_X_ActualPos", "X Actual")}
                {renderValueCard("OPC_Z_ActualPos", "Z Actual")}
                {renderValueCard("OPC_ServoOn", "Servo")}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Power className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Servo</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button disabled={writing !== null} onClick={() => writeVariables("Servo ON", { OPC_ServoOn: true })} className="gap-2">
                  {writing === "Servo ON" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                  Servo ON
                </Button>
                <Button disabled={writing !== null} onClick={() => writeVariables("Servo OFF", { OPC_ServoOn: false })} variant="outline" className="gap-2">
                  {writing === "Servo OFF" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                  Servo OFF
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">NodeId Builder</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Prefix</label>
                  <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Suffix</label>
                  <Input value={suffix} onChange={(event) => setSuffix(event.target.value)} />
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {prefix}OPC_CmdReq{suffix}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Command Pulse</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Target X</label>
                    <Input type="number" value={targetX} onChange={(event) => setTargetX(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Target Z</label>
                    <Input type="number" value={targetZ} onChange={(event) => setTargetZ(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pick Qty</label>
                    <Input type="number" value={pickQty} onChange={(event) => setPickQty(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pick Dir</label>
                    <Input type="number" value={pickDir} onChange={(event) => setPickDir(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pulse ms</label>
                    <Input type="number" value={pulseMs} onChange={(event) => setPulseMs(event.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {OPC_DEBUG_COMMAND_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      disabled={writing !== null}
                      onClick={() => pulseCommand(preset.label, preset.code)}
                      variant={preset.label === "Immediate Stop" ? "destructive" : preset.label === "Pick" ? "default" : "outline"}
                      className="gap-2"
                      title={`${preset.description}，OPC_CmdCode=${preset.code}`}
                    >
                      {writing === preset.label ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {preset.label}
                    </Button>
                  ))}
                  <div className="flex gap-2">
                    <Input type="number" value={customCode} onChange={(event) => setCustomCode(event.target.value)} />
                    <Button disabled={writing !== null} onClick={() => pulseCommand("Custom", Number(customCode))}>
                      Custom
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCcw className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Action Intervals</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {OPC_DEBUG_TIMING_FIELDS.map((field) => {
                    const variable = byName[field.name];
                    return (
                      <div key={field.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                          <Badge variant={variable?.ok ? "outline" : "destructive"}>{variable?.status ?? "--"}</Badge>
                        </div>
                        <Input
                          type="number"
                          min={50}
                          max={10000}
                          value={timingValues[field.name] ?? String(field.defaultValue)}
                          onChange={(event) => {
                            setTimingDirty(true);
                            setTimingValues((current) => ({ ...current, [field.name]: event.target.value }));
                          }}
                        />
                        <p className="truncate font-mono text-[11px] text-muted-foreground" title={variable?.nodeId}>
                          {field.name} = {valueText(variable?.value)} ms
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={writing !== null} onClick={writeTimings} className="gap-2">
                    {writing === "Action intervals" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Write Intervals
                  </Button>
                  <Button disabled={writing !== null} onClick={resetTimingDefaults} variant="outline" className="gap-2">
                    <RotateCcw className="size-4" />
                    Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bug className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Public OPC Variables</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Command</h3>
                  {renderVariableTable(commandVariables)}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Parameters</h3>
                  {renderVariableTable(parameterVariables)}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Action Intervals</h3>
                  {renderVariableTable(timingVariables)}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Status</h3>
                  {renderVariableTable(statusVariables)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
