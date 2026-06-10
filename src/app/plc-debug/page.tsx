"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bug,
  CheckCircle2,
  Gauge,
  ListChecks,
  Loader2,
  Play,
  Plus,
  Power,
  RefreshCcw,
  RotateCcw,
  Send,
  Square,
  Trash2,
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
} from "@/components/ui/select";
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

type DebugPulse = {
  commandCode: number;
  targetX?: string | number;
  targetZ?: string | number;
  pickQty?: string | number;
  pickDir?: string | number;
  servoOn?: boolean;
  pulseMs?: string | number;
};

type PickPoint = {
  id: string;
  targetX: string;
  targetZ: string;
  pickQty: string;
  pickDir: string;
};

const DEFAULT_PREFIX = "ns=4;s=变量表|";
const DEFAULT_SUFFIX = "";
const PICK_COMMAND_CODE = 1;
const UNLOAD_COMMAND_CODE = 2;
const IMMEDIATE_STOP_COMMAND_CODE = 9;
const DEFAULT_SEQUENCE_TIMEOUT_SEC = "120";
const SEQUENCE_POLL_MS = 500;
const DEFAULT_PICK_POINTS: PickPoint[] = [
  { id: "point-1", targetX: "0", targetZ: "0", pickQty: "1", pickDir: "1" },
];
const PICK_DIRECTION_OPTIONS = [
  { value: "1", label: "左侧/上侧" },
  { value: "2", label: "右侧/下侧" },
] as const;

function boolText(value: unknown) {
  return value ? "开" : "关";
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "boolean") return boolText(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}

function statusText(status: string | undefined) {
  if (!status) return "--";
  if (status === "Good") return "正常";
  if (status === "BadNodeIdUnknown") return "节点不存在";
  if (status.startsWith("Bad")) return `异常：${status}`;
  return status;
}

function statusTone(value: unknown) {
  return value ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300" : "border-border/70 bg-card/90";
}

function getStored(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  return stored;
}

function normalizePickDirection(value: unknown) {
  const directionValue = String(value ?? "1");
  return PICK_DIRECTION_OPTIONS.some((option) => option.value === directionValue) ? directionValue : "1";
}

function pickDirectionLabel(value: string) {
  return PICK_DIRECTION_OPTIONS.find((option) => option.value === normalizePickDirection(value))?.label ?? "左侧/上侧";
}

function createPickPoint(values: Partial<Omit<PickPoint, "id">> = {}): PickPoint {
  return {
    id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetX: values.targetX ?? "0",
    targetZ: values.targetZ ?? "0",
    pickQty: values.pickQty ?? "1",
    pickDir: normalizePickDirection(values.pickDir),
  };
}

function normalizeStoredPickPoint(value: unknown, index: number): PickPoint | null {
  if (typeof value !== "object" || value === null) return null;

  const point = value as Record<string, unknown>;
  return {
    id: typeof point.id === "string" ? point.id : `point-${index + 1}`,
    targetX: String(point.targetX ?? "0"),
    targetZ: String(point.targetZ ?? "0"),
    pickQty: String(point.pickQty ?? "1"),
    pickDir: normalizePickDirection(point.pickDir),
  };
}

function parseNumberInput(value: string, label: string, index: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`第 ${index + 1} 个点位的${label}不是有效数字。`);
  }
  return numericValue;
}

function parseIntegerInput(value: string, label: string, index: number, positive = false) {
  const numericValue = parseNumberInput(value, label, index);
  if (!Number.isInteger(numericValue) || (positive && numericValue <= 0)) {
    throw new Error(`第 ${index + 1} 个点位的${label}必须是${positive ? "大于 0 的" : ""}整数。`);
  }
  return numericValue;
}

function normalizePickPoint(point: PickPoint, index: number): Required<Omit<DebugPulse, "commandCode" | "servoOn" | "pulseMs">> {
  return {
    targetX: parseNumberInput(point.targetX, "目标 X", index),
    targetZ: parseNumberInput(point.targetZ, "目标 Z", index),
    pickQty: parseIntegerInput(point.pickQty, "抓取数量", index, true),
    pickDir: parseIntegerInput(point.pickDir, "抓取方向", index),
  };
}

function variableValue(payload: DebugPayload, name: string) {
  return payload.variables.find((variable) => variable.name === name)?.value;
}

function isOn(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "ON";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  const [timingEnabled, setTimingEnabled] = useState(false);
  const [timingValues, setTimingValues] = useState<Record<string, string>>(() => {
    return Object.fromEntries(OPC_DEBUG_TIMING_FIELDS.map((field) => [field.name, String(field.defaultValue)]));
  });
  const [pickPoints, setPickPoints] = useState<PickPoint[]>(DEFAULT_PICK_POINTS);
  const [pickPointsLoaded, setPickPointsLoaded] = useState(false);
  const [sequenceTimeoutSec, setSequenceTimeoutSec] = useState(DEFAULT_SEQUENCE_TIMEOUT_SEC);
  const [sequenceRunning, setSequenceRunning] = useState(false);
  const [sequenceStopping, setSequenceStopping] = useState(false);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState<number | null>(null);
  const [sequenceStatus, setSequenceStatus] = useState<string | null>(null);
  const sequenceAbortRef = useRef(false);

  useEffect(() => {
    setPrefix(getStored("stacker.opcDebug.prefix", DEFAULT_PREFIX));
    setSuffix(getStored("stacker.opcDebug.suffix", DEFAULT_SUFFIX));
    setTimingEnabled(window.localStorage.getItem("stacker.opcDebug.timingEnabled") === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("stacker.opcDebug.prefix", prefix);
    window.localStorage.setItem("stacker.opcDebug.suffix", suffix);
  }, [prefix, suffix]);

  useEffect(() => {
    window.localStorage.setItem("stacker.opcDebug.timingEnabled", String(timingEnabled));
  }, [timingEnabled]);

  useEffect(() => {
    const stored = window.localStorage.getItem("stacker.opcDebug.pickPoints");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const points = parsed
            .map((point, index) => normalizeStoredPickPoint(point, index))
            .filter((point): point is PickPoint => point !== null);
          if (points.length > 0) {
            setPickPoints(points);
          }
        }
      } catch {
        setPickPoints(DEFAULT_PICK_POINTS);
      }
    }
    setPickPointsLoaded(true);
  }, []);

  useEffect(() => {
    if (!pickPointsLoaded) return;
    window.localStorage.setItem("stacker.opcDebug.pickPoints", JSON.stringify(pickPoints));
  }, [pickPoints, pickPointsLoaded]);

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
    const query = new URLSearchParams({ prefix, suffix, includeTiming: String(timingEnabled) });
    const response = await fetch(options.url ?? `/api/plc/debug?${query.toString()}`, {
      cache: "no-store",
      ...options,
    });
    const body = await response.json() as DebugPayload | DebugErrorPayload;
    if (!response.ok) {
      throw new Error((body as DebugErrorPayload).message ?? "OPC 调试请求失败");
    }
    setPayload(body as DebugPayload);
    return body as DebugPayload;
  }, [prefix, suffix, timingEnabled]);

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
        body: JSON.stringify({ prefix, suffix, includeTiming: timingEnabled, writes }),
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
    setWriting("动作间隔");
    setMessage(null);
    setError(null);
    try {
      await requestDebug({
        url: "/api/plc/debug",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, suffix, includeTiming: true, writes }),
      });
      setMessage("动作间隔已写入");
      setTimingDirty(false);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "动作间隔写入失败");
    } finally {
      setWriting(null);
    }
  }

  function resetTimingDefaults() {
    setTimingDirty(true);
    setTimingValues(Object.fromEntries(OPC_DEBUG_TIMING_FIELDS.map((field) => [field.name, String(field.defaultValue)])));
  }

  function addPickPoint() {
    setPickPoints((current) => {
      const lastPoint = current[current.length - 1] ?? DEFAULT_PICK_POINTS[0];
      return [...current, createPickPoint(lastPoint)];
    });
  }

  function addCurrentPickPoint() {
    setPickPoints((current) => [
      ...current,
      createPickPoint({ targetX, targetZ, pickQty, pickDir }),
    ]);
  }

  function updatePickPoint(id: string, field: keyof Omit<PickPoint, "id">, value: string) {
    setPickPoints((current) => current.map((point) => (
      point.id === id ? { ...point, [field]: value } : point
    )));
  }

  function removePickPoint(id: string) {
    setPickPoints((current) => current.length > 1 ? current.filter((point) => point.id !== id) : current);
  }

  function movePickPoint(index: number, direction: -1 | 1) {
    setPickPoints((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function sendPulse(pulse: DebugPulse) {
    return requestDebug({
      url: "/api/plc/debug",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, suffix, includeTiming: timingEnabled, pulse }),
    });
  }

  async function waitForCommandCompletion(label: string) {
    const timeoutMs = Math.max(Number(sequenceTimeoutSec) || Number(DEFAULT_SEQUENCE_TIMEOUT_SEC), 5) * 1000;
    const minWaitMs = Math.max(Number(pulseMs) || 250, 250) + SEQUENCE_POLL_MS;
    const startedAt = Date.now();
    let sawRunningState = false;

    while (Date.now() - startedAt < timeoutMs) {
      if (sequenceAbortRef.current) {
        throw new Error("顺序抓取已终止。");
      }

      const snapshot = await requestDebug();
      const busy = isOn(variableValue(snapshot, "OPC_Busy"));
      const done = isOn(variableValue(snapshot, "OPC_CmdDone"));
      const commandError = isOn(variableValue(snapshot, "OPC_CmdError"));

      if (commandError) {
        throw new Error(`${label} 执行失败，错误 ID：${valueText(variableValue(snapshot, "OPC_ErrorID"))}`);
      }

      if (busy || !done) {
        sawRunningState = true;
      }

      if (done && !busy && (sawRunningState || Date.now() - startedAt >= minWaitMs)) {
        return snapshot;
      }

      await sleep(SEQUENCE_POLL_MS);
    }

    throw new Error(`${label} 等待完成超时。`);
  }

  async function runPickSequence() {
    setMessage(null);
    setError(null);

    let normalizedPoints: ReturnType<typeof normalizePickPoint>[];
    try {
      normalizedPoints = pickPoints.map((point, index) => normalizePickPoint(point, index));
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "抓取点位参数无效");
      return;
    }

    const restoreAutoRefresh = autoRefresh;

    sequenceAbortRef.current = false;
    setSequenceRunning(true);
    setWriting("顺序抓取");
    setAutoRefresh(false);

    try {
      for (const [index, point] of normalizedPoints.entries()) {
        if (sequenceAbortRef.current) {
          throw new Error("顺序抓取已终止。");
        }

        setActiveSequenceIndex(index);
        setSequenceStatus(`正在执行第 ${index + 1}/${normalizedPoints.length} 个抓取点`);
        await sendPulse({
          commandCode: PICK_COMMAND_CODE,
          targetX: point.targetX,
          targetZ: point.targetZ,
          pickQty: point.pickQty,
          pickDir: point.pickDir,
          pulseMs,
        });
        setSequenceStatus(`第 ${index + 1}/${normalizedPoints.length} 个抓取点等待完成`);
        await waitForCommandCompletion(`第 ${index + 1} 个抓取点`);
      }

      setActiveSequenceIndex(null);
      setSequenceStatus("所有抓取点已完成，正在执行卸料");
      await sendPulse({ commandCode: UNLOAD_COMMAND_CODE, pulseMs });
      await waitForCommandCompletion("卸料");
      setMessage(`顺序抓取已完成：${normalizedPoints.length} 个抓取点，已执行卸料。`);
      setSequenceStatus(null);
    } catch (sequenceError) {
      if (sequenceAbortRef.current) {
        setMessage(sequenceError instanceof Error ? sequenceError.message : "顺序抓取已终止。");
      } else {
        setError(sequenceError instanceof Error ? sequenceError.message : "顺序抓取执行失败");
      }
      setSequenceStatus(null);
    } finally {
      setActiveSequenceIndex(null);
      setSequenceRunning(false);
      setSequenceStopping(false);
      setWriting(null);
      setAutoRefresh(restoreAutoRefresh);
      sequenceAbortRef.current = false;
    }
  }

  async function stopPickSequence() {
    sequenceAbortRef.current = true;
    setSequenceStopping(true);
    setSequenceStatus("正在发送立即停止命令");

    try {
      await sendPulse({ commandCode: IMMEDIATE_STOP_COMMAND_CODE, pulseMs });
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "立即停止命令发送失败");
    }
  }

  async function pulseCommand(label: string, commandCode: number) {
    setWriting(label);
    setMessage(null);
    setError(null);
    try {
      await sendPulse({
        commandCode,
        targetX,
        targetZ,
        pickQty,
        pickDir,
        pulseMs,
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
          <Badge variant={variable?.ok ? "outline" : "destructive"}>{statusText(variable?.status)}</Badge>
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
            <span className={variable.ok ? "font-mono" : "text-red-600"}>{variable.ok ? valueText(variable.value) : statusText(variable.status)}</span>
            <span className="truncate font-mono text-xs text-muted-foreground" title={variable.nodeId}>{variable.nodeId}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderPickDirectionSelect(value: string, onValueChange: (value: string) => void, disabled = false) {
    const directionValue = normalizePickDirection(value);

    return (
      <Select
        value={directionValue}
        onValueChange={(nextValue) => onValueChange(normalizePickDirection(nextValue))}
      >
        <SelectTrigger disabled={disabled} className="w-full">
          <span className="flex flex-1 text-left">{pickDirectionLabel(directionValue)}</span>
        </SelectTrigger>
        <SelectContent>
          {PICK_DIRECTION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
                  OPC 调试
                </Badge>
                <Badge variant="outline">{OPC_DEBUG_VARIABLES.length} 个公开变量</Badge>
                <Badge variant={autoRefresh ? "secondary" : "outline"}>{autoRefresh ? "自动刷新" : "手动刷新"}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">PLC 手动调试</h1>
                <p className="pb-0.5 text-sm text-muted-foreground">直接读写公开 OPC 命令接口。</p>
              </div>
              <p className="text-sm text-muted-foreground">
                端点：<span className="font-mono text-foreground">{payload?.endpointUrl ?? "--"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setAutoRefresh((value) => !value)} size="lg" variant="outline" className="gap-2">
                {autoRefresh ? <Square className="size-4" /> : <Play className="size-4" />}
                {autoRefresh ? "暂停轮询" : "开始轮询"}
              </Button>
              <Button onClick={() => refresh()} disabled={loading} size="lg" variant="outline" className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                刷新
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
                  <h2 className="text-base font-semibold">实时状态</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {renderValueCard("OPC_Ready", "就绪")}
                {renderValueCard("OPC_Busy", "忙碌")}
                {renderValueCard("OPC_CmdAck", "命令应答")}
                {renderValueCard("OPC_CmdDone", "命令完成")}
                {renderValueCard("OPC_CmdError", "命令错误")}
                {renderValueCard("OPC_State", "状态码")}
                {renderValueCard("OPC_ErrorID", "错误 ID")}
                {renderValueCard("OPC_X_ActualPos", "X 实际位置")}
                {renderValueCard("OPC_Z_ActualPos", "Z 实际位置")}
                {renderValueCard("OPC_ServoOn", "伺服")}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Power className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">伺服控制</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button disabled={writing !== null} onClick={() => writeVariables("伺服开启", { OPC_ServoOn: true })} className="gap-2">
                  {writing === "伺服开启" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                  伺服开启
                </Button>
                <Button disabled={writing !== null} onClick={() => writeVariables("伺服关闭", { OPC_ServoOn: false })} variant="outline" className="gap-2">
                  {writing === "伺服关闭" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                  伺服关闭
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">NodeId 生成器</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">前缀</label>
                  <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">后缀</label>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="size-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">多点顺序抓取</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={sequenceRunning} onClick={addCurrentPickPoint} variant="outline" className="gap-2">
                      <Plus className="size-4" />
                      添加当前点
                    </Button>
                    <Button disabled={sequenceRunning} onClick={addPickPoint} variant="outline" className="gap-2">
                      <Plus className="size-4" />
                      新增点位
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[64px_minmax(96px,1fr)_minmax(96px,1fr)_minmax(96px,0.8fr)_minmax(96px,0.8fr)_116px] items-center gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>顺序</span>
                      <span>目标 X</span>
                      <span>目标 Z</span>
                      <span>抓取数量</span>
                      <span>抓取方向</span>
                      <span>操作</span>
                    </div>
                    {pickPoints.map((point, index) => {
                      const isActive = activeSequenceIndex === index;
                      return (
                        <div
                          key={point.id}
                          className={`grid grid-cols-[64px_minmax(96px,1fr)_minmax(96px,1fr)_minmax(96px,0.8fr)_minmax(96px,0.8fr)_116px] items-center gap-2 border-t border-border/70 px-3 py-2 ${isActive ? "bg-sky-500/8" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{index + 1}</span>
                            {isActive ? <Badge variant="secondary">执行中</Badge> : null}
                          </div>
                          <Input
                            disabled={sequenceRunning}
                            type="number"
                            value={point.targetX}
                            onChange={(event) => updatePickPoint(point.id, "targetX", event.target.value)}
                          />
                          <Input
                            disabled={sequenceRunning}
                            type="number"
                            value={point.targetZ}
                            onChange={(event) => updatePickPoint(point.id, "targetZ", event.target.value)}
                          />
                          <Input
                            disabled={sequenceRunning}
                            min={1}
                            step={1}
                            type="number"
                            value={point.pickQty}
                            onChange={(event) => updatePickPoint(point.id, "pickQty", event.target.value)}
                          />
                          {renderPickDirectionSelect(
                            point.pickDir,
                            (value) => updatePickPoint(point.id, "pickDir", value),
                            sequenceRunning,
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              aria-label="上移点位"
                              disabled={sequenceRunning || index === 0}
                              onClick={() => movePickPoint(index, -1)}
                              size="icon-sm"
                              title="上移"
                              variant="ghost"
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              aria-label="下移点位"
                              disabled={sequenceRunning || index === pickPoints.length - 1}
                              onClick={() => movePickPoint(index, 1)}
                              size="icon-sm"
                              title="下移"
                              variant="ghost"
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button
                              aria-label="删除点位"
                              disabled={sequenceRunning || pickPoints.length === 1}
                              onClick={() => removePickPoint(point.id)}
                              size="icon-sm"
                              title="删除"
                              variant="ghost"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {sequenceStatus ? (
                  <div className="rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-sm text-sky-700 dark:text-sky-300">
                    {sequenceStatus}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">单步超时 s</label>
                    <Input
                      disabled={sequenceRunning}
                      min={5}
                      step={1}
                      type="number"
                      value={sequenceTimeoutSec}
                      onChange={(event) => setSequenceTimeoutSec(event.target.value)}
                    />
                  </div>
                  <Button disabled={writing !== null || sequenceRunning || pickPoints.length === 0} onClick={runPickSequence} className="gap-2">
                    {sequenceRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    开始顺序抓取
                  </Button>
                  <Button disabled={!sequenceRunning || sequenceStopping} onClick={stopPickSequence} variant="destructive" className="gap-2">
                    {sequenceStopping ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
                    立即停止
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">命令脉冲</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">目标 X</label>
                    <Input type="number" value={targetX} onChange={(event) => setTargetX(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">目标 Z</label>
                    <Input type="number" value={targetZ} onChange={(event) => setTargetZ(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">抓取数量</label>
                    <Input type="number" value={pickQty} onChange={(event) => setPickQty(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">抓取方向</label>
                    {renderPickDirectionSelect(pickDir, setPickDir)}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">脉冲时长 ms</label>
                    <Input type="number" value={pulseMs} onChange={(event) => setPulseMs(event.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {OPC_DEBUG_COMMAND_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      disabled={writing !== null}
                      onClick={() => pulseCommand(preset.label, preset.code)}
                      variant={preset.label === "立即停止" ? "destructive" : preset.label === "抓取" ? "default" : "outline"}
                      className="gap-2"
                      title={`${preset.description}，OPC_CmdCode=${preset.code}`}
                    >
                      {writing === preset.label ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {preset.label}
                    </Button>
                  ))}
                  <div className="flex gap-2">
                    <Input type="number" value={customCode} onChange={(event) => setCustomCode(event.target.value)} />
                    <Button disabled={writing !== null} onClick={() => pulseCommand("自定义", Number(customCode))}>
                      自定义
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="size-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">动作间隔</h2>
                  </div>
                  <Button
                    disabled={loading || writing !== null}
                    onClick={() => setTimingEnabled((value) => !value)}
                    variant={timingEnabled ? "secondary" : "outline"}
                  >
                    {timingEnabled ? "停止读取" : "读取动作间隔"}
                  </Button>
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
                          <Badge variant={timingEnabled && !variable?.ok ? "destructive" : "outline"}>
                            {timingEnabled ? statusText(variable?.status) : "未读取"}
                          </Badge>
                        </div>
                        <Input
                          disabled={!timingEnabled}
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
                  <Button disabled={writing !== null || !timingEnabled} onClick={writeTimings} className="gap-2">
                    {writing === "动作间隔" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    写入间隔
                  </Button>
                  <Button disabled={writing !== null} onClick={resetTimingDefaults} variant="outline" className="gap-2">
                    <RotateCcw className="size-4" />
                    默认值
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bug className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">公开 OPC 变量</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">命令</h3>
                  {renderVariableTable(commandVariables)}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">参数</h3>
                  {renderVariableTable(parameterVariables)}
                </div>
                <div>
                  {timingEnabled && timingVariables.length > 0 ? (
                    <>
                      <h3 className="mb-2 text-sm font-semibold">动作间隔</h3>
                      {renderVariableTable(timingVariables)}
                    </>
                  ) : null}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">状态</h3>
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
