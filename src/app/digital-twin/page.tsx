"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Bot,
  Boxes,
  Cable,
  ChevronDown,
  Dot,
  Gauge,
  ListTree,
  Pause,
  Play,
  Radar,
  RefreshCcw,
  ScanSearch,
  TimerReset,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildDispatchTaskPayload, emptyPlcStatusSnapshot } from "@/lib/plc";
import { PlcApiError, fetchPlcStatusSnapshot, sendPlcCommand } from "@/lib/plc-client";
import { cn } from "@/lib/utils";
import { mockTwinDataSource } from "@/lib/digital-twin";
import type {
  PlcLastCommand,
  PlcMachineState,
  PlcMode,
  PlcStatusSnapshot,
  TwinConfig,
  TwinLogEntry,
  TwinMachinePhase,
  TwinPickStep,
  TwinPickStepStatus,
  TwinQueueTask,
  TwinQueueTaskStatus,
  TwinRackSlot,
  TwinRobotState,
  TwinSide,
  TwinSnapshot,
  TwinSlotStatus,
  TwinTransferBinEntry,
} from "@/lib/types";

const TIMELINE = [
  { phase: "moving" as const, duration: 900 },
  { phase: "rotating" as const, duration: 450 },
  { phase: "extending" as const, duration: 350 },
  { phase: "suction" as const, duration: 250 },
  { phase: "retracting" as const, duration: 300 },
  { phase: "dropping" as const, duration: 250 },
];

const STEP_INTERVAL = 300;
const STAGE_VIEWBOX = { width: 1760, height: 680 };

type PlaybackSpeed = 1 | 2;
type SimulationStatus = "idle" | "running" | "paused" | "completed" | "alarm";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function sideLabel(side: TwinSide) {
  return side === "left" ? "上" : "下";
}

function phaseLabel(phase: TwinMachinePhase) {
  const labels: Record<TwinMachinePhase, string> = {
    idle: "待命",
    moving: "移动中",
    rotating: "旋转中",
    extending: "气缸伸出",
    suction: "真空吸附",
    retracting: "回收中",
    dropping: "落箱中",
    paused: "已暂停",
    completed: "已完成",
    alarm: "告警",
  };

  return labels[phase];
}

function statusTone(status: SimulationStatus) {
  if (status === "completed") return "text-emerald-600 dark:text-emerald-400";
  if (status === "alarm") return "text-red-600 dark:text-red-400";
  if (status === "running") return "text-blue-600 dark:text-blue-400";
  if (status === "paused") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function plcStateLabel(state: PlcMachineState) {
  const labels: Record<PlcMachineState, string> = {
    idle: "待命",
    running: "运行中",
    paused: "已暂停",
    alarm: "告警",
    unknown: "未知",
  };

  return labels[state];
}

function plcStatusTone(state: PlcMachineState) {
  if (state === "running") return "text-blue-600 dark:text-blue-400";
  if (state === "paused") return "text-amber-600 dark:text-amber-400";
  if (state === "alarm") return "text-red-600 dark:text-red-400";
  if (state === "idle") return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

function plcCommandResultLabel(result: PlcLastCommand["result"]) {
  const labels: Record<PlcLastCommand["result"], string> = {
    ok: "成功",
    rejected: "拒绝",
    timeout: "超时",
    transport_error: "链路错误",
  };

  return labels[result];
}

function slotTone(slot: TwinRackSlot, isActive: boolean, isFocused: boolean) {
  if (isActive) return "fill-[rgba(59,130,246,0.22)] stroke-[rgba(59,130,246,0.92)]";
  if (isFocused) return "fill-[rgba(245,158,11,0.20)] stroke-[rgba(245,158,11,0.9)]";
  if (slot.status === "empty") return "fill-[rgba(239,68,68,0.12)] stroke-[rgba(239,68,68,0.55)]";
  if (slot.status === "low") return "fill-[rgba(245,158,11,0.12)] stroke-[rgba(245,158,11,0.48)]";
  return "fill-[rgba(148,163,184,0.12)] stroke-[rgba(148,163,184,0.42)]";
}

function cloneTask(task: TwinQueueTask | null) {
  if (!task) return null;

  return {
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  };
}

function cloneLogs(logs: TwinLogEntry[]) {
  return logs.map((entry) => ({ ...entry }));
}

function cloneTransferBin(entries: TwinTransferBinEntry[]) {
  return entries.map((entry) => ({ ...entry }));
}

function cloneQueue(queue: TwinQueueTask[]) {
  return queue.map((task) => ({
    ...task,
    steps: task.steps.map((step) => ({ ...step })),
  }));
}

function cloneSlots(slots: TwinRackSlot[]) {
  return slots.map((slot) => ({ ...slot }));
}

function createLog(level: TwinLogEntry["level"], message: string): TwinLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: formatTime(new Date()),
    level,
    message,
  };
}

function currentStepIndex(task: TwinQueueTask | null) {
  if (!task) return -1;
  return task.steps.findIndex((step) => step.status !== "completed");
}

function currentStep(task: TwinQueueTask | null) {
  if (!task) return null;
  return task.steps.find((step) => step.status !== "completed") ?? null;
}

function setTaskStepStatus(task: TwinQueueTask | null, stepId: string, status: TwinPickStep["status"]) {
  if (!task) return null;

  const steps = task.steps.map((step) => (step.id === stepId ? { ...step, status } : step));

  return {
    ...task,
    completedSteps: steps.filter((step) => step.status === "completed").length,
    steps,
  };
}

function updateQueueFromTask(queue: TwinQueueTask[], task: TwinQueueTask | null, status?: TwinQueueTask["status"]) {
  if (!task) return queue;

  return queue.map((entry) => {
    if (entry.taskNo !== task.taskNo) return entry;

    return {
      ...task,
      status: status ?? entry.status,
    };
  });
}

function countCompletedSteps(task: TwinQueueTask | null) {
  if (!task) return 0;
  return task.steps.filter((step) => step.status === "completed").length;
}

function totalPickedQuantity(entries: TwinTransferBinEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function resolveSlotStatus(stockQty: number): TwinSlotStatus {
  if (stockQty <= 0) return "empty";
  if (stockQty < 30) return "low";
  return "ready";
}

function resetTaskStepStatus(task: TwinQueueTask | null, stepId: string, status: TwinPickStepStatus) {
  if (!task) return null;

  const steps = task.steps.map((step): TwinPickStep => (
    step.id === stepId ? { ...step, status } : step
  ));

  return {
    ...task,
    steps,
    completedSteps: steps.filter((step) => step.status === "completed").length,
  };
}

type AnimatedRobotDisplay = {
  xColumn: number;
  zLevel: number;
  facingScale: number;
  cylinderProgress: number;
  vacuumProgress: number;
};

const PHASE_MOTION_DURATION: Record<TwinMachinePhase, number> = {
  idle: 220,
  moving: 900,
  rotating: 450,
  extending: 350,
  suction: 250,
  retracting: 300,
  dropping: 250,
  paused: 180,
  completed: 260,
  alarm: 180,
};

function sideToScale(side: TwinSide) {
  return side === "left" ? -1 : 1;
}

function toAnimatedRobotDisplay(robot: TwinRobotState): AnimatedRobotDisplay {
  return {
    xColumn: robot.xColumn,
    zLevel: robot.zLevel,
    facingScale: sideToScale(robot.facingSide),
    cylinderProgress: robot.cylinderExtended ? 1 : 0,
    vacuumProgress: robot.vacuumOn ? 1 : 0,
  };
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function easeOutQuint(progress: number) {
  return 1 - Math.pow(1 - progress, 5);
}

function getPhaseMotionDuration(phase: TwinMachinePhase, playbackSpeed: PlaybackSpeed) {
  return Math.max(120, PHASE_MOTION_DURATION[phase] / playbackSpeed);
}

function getPhaseMotionEasing(phase: TwinMachinePhase) {
  if (phase === "moving" || phase === "rotating") return easeInOutCubic;
  if (phase === "extending") return easeOutQuint;
  return easeOutCubic;
}

function useAnimatedRobotMotion(robot: TwinRobotState, playbackSpeed: PlaybackSpeed) {
  const [display, setDisplay] = useState<AnimatedRobotDisplay>(() => toAnimatedRobotDisplay(robot));
  const displayRef = useRef(display);
  const frameRef = useRef<number | null>(null);
  const previousPhaseRef = useRef(robot.phase);
  const {
    xColumn,
    zLevel,
    facingSide,
    cylinderExtended,
    vacuumOn,
    phase,
    activeTaskNo,
    activeSlotId,
  } = robot;

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    previousPhaseRef.current = phase;

    const from = displayRef.current;
    const to: AnimatedRobotDisplay = {
      xColumn,
      zLevel,
      facingScale: sideToScale(facingSide),
      cylinderProgress: cylinderExtended ? 1 : 0,
      vacuumProgress: vacuumOn ? 1 : 0,
    };
    const robotPhase = phase;
    const duration = getPhaseMotionDuration(robotPhase, playbackSpeed);
    const easing = getPhaseMotionEasing(robotPhase);

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easing(progress);
      const vacuumMix = robotPhase === "suction" ? Math.min(1, eased * 1.35) : eased;
      const nextDisplay: AnimatedRobotDisplay = {
        xColumn: lerp(from.xColumn, to.xColumn, eased),
        zLevel: lerp(from.zLevel, to.zLevel, eased),
        facingScale: lerp(from.facingScale, to.facingScale, eased),
        cylinderProgress: lerp(from.cylinderProgress, to.cylinderProgress, eased),
        vacuumProgress: lerp(from.vacuumProgress, to.vacuumProgress, vacuumMix),
      };

      displayRef.current = nextDisplay;
      setDisplay(nextDisplay);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    }

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [
    xColumn,
    zLevel,
    facingSide,
    cylinderExtended,
    vacuumOn,
    phase,
    playbackSpeed,
  ]);

  return {
    display,
    dropBurstKey: phase === "dropping" ? `${activeTaskNo ?? "idle"}-${activeSlotId ?? "slot"}-${phase}` : null,
  };
}

function PanelShell({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-sm shadow-slate-950/5 backdrop-blur-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
            <span>{title}</span>
          </div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className={cn("px-5 py-4", contentClassName)}>{children}</div>
    </section>
  );
}

function FoldSection({
  title,
  description,
  badge,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-sm shadow-slate-950/5 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/20"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
            <span className="text-base font-semibold text-foreground">{title}</span>
            {badge ? <Badge variant="outline" className="text-[10px]">{badge}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open ? "rotate-180" : "rotate-0")} />
      </button>
      {open ? <div className="border-t border-border/70 px-5 py-4">{children}</div> : null}
    </section>
  );
}

function TwinQueuePanel({
  mode,
  activeTask,
  robot,
  simulationStatus,
  plcStatus,
  plcPendingTaskNo,
  plcCommandBusy,
  selectedSlot,
  playbackSpeed,
  onDispatchTask,
  onStart,
  onPause,
  onResume,
  onReplay,
  onSpeedChange,
}: {
  mode: PlcMode;
  activeTask: TwinQueueTask | null;
  robot: TwinRobotState;
  simulationStatus: SimulationStatus;
  plcStatus: PlcStatusSnapshot;
  plcPendingTaskNo: string | null;
  plcCommandBusy: boolean;
  selectedSlot: TwinRackSlot | null;
  playbackSpeed: PlaybackSpeed;
  onDispatchTask: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}) {
  const activeIndex = currentStepIndex(activeTask);
  const activeStep = currentStep(activeTask);
  const plcReady = plcStatus.configured && plcStatus.connected;
  const dispatchedForActiveTask = activeTask
    ? plcStatus.currentTaskNo === activeTask.taskNo || plcPendingTaskNo === activeTask.taskNo
    : false;
  const startDisabled = mode === "simulation"
    ? !activeTask || simulationStatus === "running" || simulationStatus === "completed" || simulationStatus === "alarm"
    : !activeTask || !plcReady || plcCommandBusy || !dispatchedForActiveTask || plcStatus.machineState === "running" || plcStatus.machineState === "alarm";
  const pauseDisabled = mode === "simulation"
    ? simulationStatus !== "running"
    : !plcReady || plcCommandBusy || plcStatus.machineState !== "running";
  const resumeDisabled = mode === "simulation"
    ? simulationStatus !== "paused"
    : !plcReady || plcCommandBusy || plcStatus.machineState !== "paused";
  const resetDisabled = mode === "simulation"
    ? !activeTask
    : !plcReady || plcCommandBusy;

  return (
    <PanelShell
      title="运行控制台"
      description="设备控制、模式状态与当前执行摘要"
      icon={ListTree}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {mode === "plc" ? (
            <Button size="sm" variant="secondary" onClick={onDispatchTask} disabled={!activeTask || !plcReady || plcCommandBusy}>
              <Cable className="size-3.5" />
              下发任务
            </Button>
          ) : null}
          <Button size="sm" onClick={onStart} disabled={startDisabled}>
            <Play className="size-3.5" />
            开始
          </Button>
          <Button size="sm" variant="outline" onClick={onPause} disabled={pauseDisabled}>
            <Pause className="size-3.5" />
            暂停
          </Button>
          <Button size="sm" variant="outline" onClick={onResume} disabled={resumeDisabled}>
            <Play className="size-3.5" />
            继续
          </Button>
          <Button size="sm" variant="ghost" onClick={onReplay} disabled={resetDisabled}>
            <RefreshCcw className="size-3.5" />
            {mode === "simulation" ? "重播" : "复位"}
          </Button>
        </div>

        {mode === "simulation" ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/28 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">播放速度</p>
              <p className="mt-1 text-sm font-medium">当前 {playbackSpeed}x</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={playbackSpeed === 1 ? "default" : "outline"} onClick={() => onSpeedChange(1)}>
                1x
              </Button>
              <Button size="sm" variant={playbackSpeed === 2 ? "default" : "outline"} onClick={() => onSpeedChange(2)}>
                2x
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-muted/28 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">PLC 联机状态</p>
                <p className="mt-1 text-sm font-medium">
                  {!plcStatus.configured ? "未配置" : plcStatus.connected ? "在线" : "离线"}
                </p>
              </div>
              <Badge variant={plcReady ? "secondary" : "outline"}>
                {plcCommandBusy ? "命令处理中" : "可操作"}
              </Badge>
            </div>
            {plcStatus.lastCommand ? (
              <p className="mt-2 text-xs text-muted-foreground">
                最近命令：{plcStatus.lastCommand.command} · {plcCommandResultLabel(plcStatus.lastCommand.result)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">尚未发送 PLC 命令</p>
            )}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="size-4" />
              <span className="text-xs font-medium">设备状态</span>
            </div>
            {mode === "simulation" ? (
              <>
                <p className={cn("mt-2 text-lg font-semibold", statusTone(simulationStatus))}>{phaseLabel(robot.phase)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  朝向{sideLabel(robot.facingSide)}侧 · X{robot.xColumn} / Z{robot.zLevel}
                </p>
              </>
            ) : (
              <>
                <p className={cn("mt-2 text-lg font-semibold", plcStatusTone(plcStatus.machineState))}>
                  {plcStateLabel(plcStatus.machineState)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  当前 PLC 任务：{plcStatus.currentTaskNo ?? "--"}
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="size-4" />
              <span className="text-xs font-medium">当前步骤</span>
            </div>
            {activeStep ? (
              <>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {activeIndex + 1}/{activeTask?.steps.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sideLabel(activeStep.side)}侧 {activeStep.column} 列 {activeStep.level} 层
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-semibold text-foreground">已完成</p>
                <p className="mt-1 text-xs text-muted-foreground">当前任务暂无待执行步骤</p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ScanSearch className="size-4" />
              <span className="text-xs font-medium">焦点库位</span>
            </div>
            {selectedSlot ? (
              <>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {sideLabel(selectedSlot.side)}-{selectedSlot.column}-{selectedSlot.level}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {selectedSlot.productName}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-semibold text-foreground">未选中</p>
                <p className="mt-1 text-xs text-muted-foreground">点击明细或库位查看详情</p>
              </>
            )}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function TwinStage({
  config,
  slots,
  robot,
  playbackSpeed,
  activeStep,
  focusedSlotId,
  onSelectSlot,
}: {
  config: TwinConfig;
  slots: TwinRackSlot[];
  robot: TwinRobotState;
  playbackSpeed: PlaybackSpeed;
  activeStep: TwinPickStep | null;
  focusedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const { display: animatedRobot, dropBurstKey } = useAnimatedRobotMotion(robot, playbackSpeed);
  const focusedSlot = useMemo(
    () => slots.find((slot) => slot.id === focusedSlotId) ?? null,
    [focusedSlotId, slots],
  );
  const stage = useMemo(() => {
    const rackLeft = 56;
    const rackRight = 32;
    const rackWidth = STAGE_VIEWBOX.width - rackLeft - rackRight;
    const rackHeight = 184;
    const topRackY = 76;
    const rackGap = 126;
    const bottomRackY = topRackY + rackHeight + rackGap;
    const railY = topRackY + rackHeight + rackGap / 2;
    const cellWidth = rackWidth / config.rackColumns;
    const cellHeight = rackHeight / config.rackLevels;
    const xTrackLeft = rackLeft;
    const xTrackRight = rackLeft + rackWidth;
    const xSpan = xTrackRight - xTrackLeft;
    const stageCenterX = rackLeft + rackWidth / 2;
    const robotX = xTrackLeft + ((animatedRobot.xColumn - 0.5) / config.rackColumns) * xSpan;
    const levelProgress = (config.rackLevels - animatedRobot.zLevel + 0.5) / config.rackLevels;
    const topLiftY = topRackY + levelProgress * rackHeight;
    const bottomLiftY = bottomRackY + levelProgress * rackHeight;
    const facingProgress = (animatedRobot.facingScale + 1) / 2;
    const liftY = lerp(topLiftY, bottomLiftY, facingProgress);
    const armLength = 34;
    const armEndX = robotX;
    const armEndY = liftY + armLength * animatedRobot.facingScale;
    const cylinderLength = lerp(20, 54, animatedRobot.cylinderProgress);
    const cylinderEndX = armEndX + animatedRobot.facingScale * 12;
    const cylinderEndY = armEndY + animatedRobot.facingScale * cylinderLength;
    const binY = railY + 136;
    const footerX = 24;
    const footerWidth = STAGE_VIEWBOX.width - footerX * 2;
    const footerY = bottomRackY + rackHeight + 22;
    const footerTextY = footerY + 36;
    const highlightPulse = robot.phase === "dropping" ? 1 : 0;
    const suctionGlow = lerp(0.2, 1, animatedRobot.vacuumProgress);

    return {
      rackLeft,
      rackRight,
      rackWidth,
      topRackY,
      bottomRackY,
      rackHeight,
      cellWidth,
      cellHeight,
      xTrackLeft,
      xTrackRight,
      stageCenterX,
      robotX,
      railY,
      topLiftY,
      bottomLiftY,
      liftY,
      armEndX,
      armEndY,
      cylinderEndX,
      cylinderEndY,
      binY,
      footerX,
      footerWidth,
      footerY,
      footerTextY,
      highlightPulse,
      suctionGlow,
    };
  }, [animatedRobot, config, robot.phase]);
  const highlightedColumns = useMemo(() => {
    const columns = new Set<number>();
    const currentColumn = Math.min(config.rackColumns, Math.max(1, Math.round(animatedRobot.xColumn)));

    columns.add(currentColumn);
    if (activeStep) columns.add(activeStep.column);
    if (focusedSlot) columns.add(focusedSlot.column);

    return Array.from(columns).sort((left, right) => left - right);
  }, [activeStep, animatedRobot.xColumn, config.rackColumns, focusedSlot]);

  function getSlotCenter(side: TwinSide, column: number, level: number) {
    const rackY = side === "left" ? stage.topRackY : stage.bottomRackY;

    return {
      x: stage.rackLeft + (column - 0.5) * stage.cellWidth,
      y: rackY + ((config.rackLevels - level + 0.5) / config.rackLevels) * stage.rackHeight,
    };
  }

  const activeTarget = activeStep
    ? getSlotCenter(activeStep.side, activeStep.column, activeStep.level)
    : null;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.04),_transparent)] px-0 py-0.5 sm:px-0.5 sm:py-1 lg:px-1 lg:py-1.5">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),transparent)]" />
      <svg
        viewBox={`0 0 ${STAGE_VIEWBOX.width} ${STAGE_VIEWBOX.height}`}
        className="relative aspect-[1760/680] w-full"
        role="img"
        aria-label="立库出库系统数字孪生舞台"
      >
        <defs>
          <linearGradient id="stage-floor" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(15,23,42,0.04)" />
            <stop offset="100%" stopColor="rgba(30,41,59,0.12)" />
          </linearGradient>
          <linearGradient id="gantry" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(71,85,105,0.92)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.72)" />
          </linearGradient>
          <linearGradient id="robot-arm" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(14,165,233,0.85)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.95)" />
          </linearGradient>
          <filter id="slotGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="186" cy="132" r="180" fill="rgba(59,130,246,0.09)" opacity="0.22" />
        <circle cx={STAGE_VIEWBOX.width - 186} cy="564" r="220" fill="rgba(255,255,255,0.52)" opacity="0.34" />
        <rect
          x={stage.rackLeft - 12}
          y={stage.topRackY - 26}
          width={stage.rackWidth + 24}
          height={stage.rackHeight + 52}
          rx="28"
          fill="rgba(255,255,255,0.14)"
        />
        <rect
          x={stage.rackLeft - 12}
          y={stage.bottomRackY - 26}
          width={stage.rackWidth + 24}
          height={stage.rackHeight + 52}
          rx="28"
          fill="rgba(255,255,255,0.14)"
        />
        <rect x={stage.footerX} y={stage.footerY} width={stage.footerWidth} height="64" rx="24" fill="url(#stage-floor)" opacity="0.68" />

        <text x="18" y="34" className="fill-muted-foreground text-[15px] font-semibold">
          立库出库系统数字孪生舞台
        </text>
        <text x="18" y="52" className="fill-muted-foreground text-[12px]">
          X 轴 5 米 / 30 列，Z 轴 2 米 / 8 层，单巷道上下双排货架
        </text>

        <line x1={stage.xTrackLeft} y1={stage.railY} x2={stage.xTrackRight} y2={stage.railY} stroke="rgba(71,85,105,0.42)" strokeWidth="14" strokeLinecap="round" />
        <line x1={stage.xTrackLeft} y1={stage.railY} x2={stage.xTrackRight} y2={stage.railY} stroke="rgba(148,163,184,0.18)" strokeWidth="28" strokeLinecap="round" />

        <rect x={stage.rackLeft} y={stage.topRackY} width={stage.rackWidth} height={stage.rackHeight} rx="20" fill="rgba(248,250,252,0.22)" stroke="rgba(148,163,184,0.42)" strokeWidth="2" />
        <rect x={stage.rackLeft} y={stage.bottomRackY} width={stage.rackWidth} height={stage.rackHeight} rx="20" fill="rgba(248,250,252,0.22)" stroke="rgba(148,163,184,0.42)" strokeWidth="2" />

        {highlightedColumns.map((column) => {
          const x = stage.rackLeft + (column - 1) * stage.cellWidth;
          const labelX = x + stage.cellWidth / 2;
          const bandY = stage.topRackY - 10;
          const bandHeight = stage.bottomRackY + stage.rackHeight - bandY + 10;

          return (
            <g key={`column-highlight-${column}`}>
              <rect
                x={x + 2}
                y={bandY}
                width={Math.max(stage.cellWidth - 4, 10)}
                height={bandHeight}
                rx="12"
                fill="rgba(59,130,246,0.05)"
              />
              <line
                x1={labelX}
                y1={stage.topRackY - 24}
                x2={labelX}
                y2={stage.bottomRackY + stage.rackHeight + 24}
                stroke="rgba(59,130,246,0.28)"
                strokeWidth="2"
                strokeDasharray="10 10"
              />
              <rect
                x={labelX - 16}
                y={stage.bottomRackY + stage.rackHeight + 18}
                width="32"
                height="20"
                rx="10"
                fill="rgba(15,23,42,0.92)"
              />
              <text x={labelX} y={stage.bottomRackY + stage.rackHeight + 32} textAnchor="middle" className="fill-white text-[10px] font-semibold">
                {column}
              </text>
            </g>
          );
        })}

        {Array.from({ length: config.rackLevels }, (_, index) => {
          const yTop = stage.topRackY + index * stage.cellHeight;
          const yBottom = stage.bottomRackY + index * stage.cellHeight;
          const level = config.rackLevels - index;

          return (
            <g key={`level-${level}`}>
              <line x1={stage.rackLeft} y1={yTop} x2={stage.rackLeft + stage.rackWidth} y2={yTop} stroke="rgba(148,163,184,0.24)" strokeWidth="1.5" />
              <line x1={stage.rackLeft} y1={yBottom} x2={stage.rackLeft + stage.rackWidth} y2={yBottom} stroke="rgba(148,163,184,0.24)" strokeWidth="1.5" />
              <text x={stage.rackLeft - 26} y={yTop + stage.cellHeight * 0.62} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {level} 层
              </text>
              <text x={stage.rackLeft - 26} y={yBottom + stage.cellHeight * 0.62} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {level} 层
              </text>
            </g>
          );
        })}

        {Array.from({ length: config.rackColumns }, (_, index) => {
          const x = stage.rackLeft + index * stage.cellWidth;

          return (
            <g key={`column-${index + 1}`}>
              <line x1={x} y1={stage.topRackY} x2={x} y2={stage.topRackY + stage.rackHeight} stroke="rgba(148,163,184,0.22)" strokeWidth="1.2" />
              <line x1={x} y1={stage.bottomRackY} x2={x} y2={stage.bottomRackY + stage.rackHeight} stroke="rgba(148,163,184,0.22)" strokeWidth="1.2" />
            </g>
          );
        })}

        {slots.map((slot) => {
          const rackY = slot.side === "left" ? stage.topRackY : stage.bottomRackY;
          const y = rackY + (config.rackLevels - slot.level) * stage.cellHeight + 4;
          const x = stage.rackLeft + (slot.column - 1) * stage.cellWidth + 4;
          const width = stage.cellWidth - 8;
          const height = stage.cellHeight - 8;
          const isActive = activeStep?.slotId === slot.id;
          const isFocused = focusedSlotId === slot.id;
          const showLabel = isActive || isFocused;

          return (
            <g key={slot.id}>
              {isActive ? (
                <rect
                  x={x - 4}
                  y={y - 4}
                  width={width + 8}
                  height={height + 8}
                  rx="14"
                  className="twin-slot-pulse"
                  fill="rgba(59,130,246,0.12)"
                  filter="url(#slotGlow)"
                />
              ) : null}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={Math.max(4, Math.min(10, width * 0.3))}
                className={cn("cursor-pointer transition-colors duration-300", slotTone(slot, isActive, isFocused))}
                onClick={() => onSelectSlot(slot.id)}
              />
              {showLabel ? (
                <text x={x + width / 2} y={y + height / 2 + 3} textAnchor="middle" className="fill-foreground text-[8px] font-semibold">
                  {slot.column}-{slot.level}
                </text>
              ) : null}
            </g>
          );
        })}

        <g transform={`translate(${stage.robotX}, ${stage.railY})`}>
          <rect x="-102" y="-16" width="204" height="28" rx="14" fill="url(#gantry)" />
          <rect x="-28" y="-30" width="56" height="60" rx="16" fill="rgba(15,23,42,0.92)" />
          <circle cx="0" cy="0" r="19" fill="rgba(30,41,59,0.92)" stroke="rgba(148,163,184,0.45)" strokeWidth="2" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={stage.liftY - stage.railY}
            stroke="url(#gantry)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="0" cy={stage.liftY - stage.railY} r="15" fill="rgba(15,23,42,0.92)" stroke="rgba(148,163,184,0.45)" strokeWidth="2" />
          <line
            x1="0"
            y1={stage.liftY - stage.railY}
            x2={stage.armEndX - stage.robotX}
            y2={stage.armEndY - stage.railY}
            stroke="url(#robot-arm)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <line
            x1={stage.armEndX - stage.robotX}
            y1={stage.armEndY - stage.railY}
            x2={stage.cylinderEndX - stage.robotX}
            y2={stage.cylinderEndY - stage.railY}
            stroke={robot.phase === "extending" || robot.phase === "suction" ? "rgba(245,158,11,0.92)" : "rgba(148,163,184,0.88)"}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <circle
            cx={stage.cylinderEndX - stage.robotX}
            cy={stage.cylinderEndY - stage.railY}
            r={7.5 + stage.suctionGlow * 2}
            fill={robot.vacuumOn ? "rgba(245,158,11,1)" : "rgba(15,23,42,0.92)"}
            opacity={0.88 + stage.suctionGlow * 0.12}
          />
          {robot.vacuumOn ? (
            <circle
              cx={stage.cylinderEndX - stage.robotX}
              cy={stage.cylinderEndY - stage.railY}
              r={14 + stage.suctionGlow * 5}
              className="twin-vacuum-halo"
              fill="rgba(245,158,11,0.18)"
            />
          ) : null}
          <line x1="0" y1="20" x2="0" y2={stage.binY - stage.railY - 26} stroke="rgba(71,85,105,0.65)" strokeWidth="5" strokeLinecap="round" />
          <rect x="-52" y={stage.binY - stage.railY - 26} width="104" height="52" rx="14" fill="rgba(15,23,42,0.92)" stroke={robot.phase === "dropping" ? "rgba(16,185,129,0.62)" : "rgba(148,163,184,0.35)"} strokeWidth="2.5" />
          <text x="0" y={stage.binY - stage.railY + 6} textAnchor="middle" className="fill-white text-[11px] font-medium">
            中转箱
          </text>
          {robot.phase === "dropping" ? (
            <g key={dropBurstKey}>
              <circle
                cx={stage.cylinderEndX - stage.robotX}
                cy={stage.cylinderEndY - stage.railY + 22}
                r={7 + stage.highlightPulse}
                className="twin-drop-pulse"
                fill="rgba(245,158,11,0.95)"
              />
              <circle
                cx={stage.cylinderEndX - stage.robotX}
                cy={stage.cylinderEndY - stage.railY + 11}
                r="4.5"
                className="twin-drop-pulse twin-drop-pulse-delay"
                fill="rgba(251,191,36,0.85)"
              />
            </g>
          ) : null}
        </g>

        {activeStep ? (
          <>
            <line
              x1={stage.robotX}
              y1={stage.liftY}
              x2={activeTarget?.x ?? stage.robotX}
              y2={activeTarget?.y ?? stage.liftY}
              stroke="rgba(59,130,246,0.4)"
              strokeWidth="3"
              strokeDasharray="12 12"
              className="twin-dash-line"
            />
            <text x={stage.stageCenterX} y={stage.footerTextY} textAnchor="middle" className="fill-foreground text-[13px] font-medium">
              当前目标：{sideLabel(activeStep.side)}侧 {activeStep.column} 列 {activeStep.level} 层 · {activeStep.productName} ×{activeStep.quantity}
            </text>
          </>
        ) : (
          <text x={stage.stageCenterX} y={stage.footerTextY} textAnchor="middle" className="fill-muted-foreground text-[13px]">
            当前任务已完成，可选择重播或切换任务
          </text>
        )}
      </svg>
    </div>
  );
}

function TwinDetailPanel({
  activeTask,
  selectedSlot,
  transferBin,
  alarmMessage,
}: {
  activeTask: TwinQueueTask | null;
  selectedSlot: TwinRackSlot | null;
  transferBin: TwinTransferBinEntry[];
  alarmMessage: string | null;
}) {
  const totalQuantity = totalPickedQuantity(transferBin);

  return (
    <PanelShell
      title="目标与物料"
      description="当前库位聚焦、中转箱累计与异常提醒"
      icon={Boxes}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/70 bg-muted/28 px-4 py-4">
            <p className="text-xs text-muted-foreground">累计件数</p>
            <p className="mt-2 text-3xl font-semibold">{totalQuantity}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              已完成 {transferBin.length} 个 SKU 聚合步骤
            </p>
          </div>

          {selectedSlot ? (
            <div className="rounded-[24px] border border-border/70 bg-background/70 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">库位编号</p>
                  <p className="mt-1 text-lg font-semibold">
                    {sideLabel(selectedSlot.side)}-{selectedSlot.column}-{selectedSlot.level}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedSlot.status === "ready"
                      ? "secondary"
                      : selectedSlot.status === "low"
                        ? "outline"
                        : "destructive"
                  }
                >
                  {selectedSlot.status === "ready" ? "库存正常" : selectedSlot.status === "low" ? "库存偏低" : "库存为空"}
                </Badge>
              </div>
              <p className="mt-4 text-sm font-medium">{selectedSlot.productName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedSlot.productCode}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-xs text-muted-foreground">当前库存</p>
                  <p className="mt-1 font-semibold">{selectedSlot.stockQty}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-3">
                  <p className="text-xs text-muted-foreground">当前任务</p>
                  <p className="mt-1 font-semibold">{activeTask?.taskNo ?? "--"}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              点击舞台库位或下方步骤明细查看库位详情
            </div>
          )}

          {alarmMessage ? (
            <div className="rounded-[24px] border border-red-500/30 bg-red-500/8 px-4 py-4 text-sm text-red-700 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">执行已停止</p>
                  <p className="mt-1">{alarmMessage}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {transferBin.length > 0 ? transferBin.map((entry) => (
            <div key={`${entry.productCode}-${entry.pickedAt}`} className="rounded-[22px] border border-border/70 bg-background/65 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.productName}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{entry.productCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">×{entry.quantity}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{entry.pickedAt}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              中转箱尚未接收到物料
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

export default function DigitalTwinPage() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PlcMode>("simulation");
  const [baselineSnapshot, setBaselineSnapshot] = useState<TwinSnapshot | null>(null);
  const [activeTask, setActiveTask] = useState<TwinQueueTask | null>(null);
  const [queue, setQueue] = useState<TwinQueueTask[]>([]);
  const [slots, setSlots] = useState<TwinRackSlot[]>([]);
  const [robot, setRobot] = useState<TwinRobotState | null>(null);
  const [logs, setLogs] = useState<TwinLogEntry[]>([]);
  const [transferBin, setTransferBin] = useState<TwinTransferBinEntry[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>("idle");
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [alarmMessage, setAlarmMessage] = useState<string | null>(null);
  const [plcStatus, setPlcStatus] = useState<PlcStatusSnapshot>(() => emptyPlcStatusSnapshot());
  const [plcCommandBusy, setPlcCommandBusy] = useState(false);
  const [plcPendingTaskNo, setPlcPendingTaskNo] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const generationRef = useRef(0);
  const activeTaskRef = useRef<TwinQueueTask | null>(null);
  const slotsRef = useRef<TwinRackSlot[]>([]);
  const playbackSpeedRef = useRef<PlaybackSpeed>(1);
  const pollingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    activeTaskRef.current = activeTask;
  }, [activeTask]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const initialSnapshot = await mockTwinDataSource.getTwinSnapshot();
      if (ignore) return;

      const currentTask = cloneTask(initialSnapshot.activeTask);
      const currentQueue = cloneQueue(initialSnapshot.queue);
      const currentSlots = cloneSlots(initialSnapshot.slots);
      const currentRobot = { ...initialSnapshot.robot };
      const currentLogs = cloneLogs(initialSnapshot.logs);
      const currentTransferBin = cloneTransferBin(initialSnapshot.transferBin);

      setBaselineSnapshot(initialSnapshot);
      setQueue(currentQueue);
      setSlots(currentSlots);
      setRobot(currentRobot);
      setActiveTask(currentTask);
      activeTaskRef.current = currentTask;
      slotsRef.current = currentSlots;
      setLogs(currentLogs);
      setTransferBin(currentTransferBin);
      setSelectedSlotId(currentTask?.steps[0]?.slotId ?? null);
      setSimulationStatus("idle");
      setAlarmMessage(null);
      setLoading(false);
    }

    load();

    return () => {
      ignore = true;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "plc") {
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const snapshot = await fetchPlcStatusSnapshot();
        if (cancelled) return;
        setPlcStatus(snapshot);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof PlcApiError && error.snapshot) {
          setPlcStatus(error.snapshot);
        } else {
          setPlcStatus({
            ...emptyPlcStatusSnapshot(),
            updatedAt: new Date().toISOString(),
          });
        }
      } finally {
        if (cancelled) return;
        const interval = document.visibilityState === "visible" ? 2000 : 5000;
        pollingTimerRef.current = window.setTimeout(poll, interval);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "plc") return;

    clearTimers();
    generationRef.current += 1;
    setSimulationStatus("idle");
    setAlarmMessage(null);
    setTransferBin([]);
    if (baselineSnapshot) {
      const nextSlots = cloneSlots(baselineSnapshot.slots);
      setSlots(nextSlots);
      slotsRef.current = nextSlots;
      setRobot((current) => current ? {
        ...current,
        phase: "idle",
        cylinderExtended: false,
        vacuumOn: false,
      } : current);
    }
  }, [mode, baselineSnapshot]);

  const config = baselineSnapshot?.config;
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [selectedSlotId, slots],
  );

  const activeStep = currentStep(activeTask);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function pushLog(level: TwinLogEntry["level"], message: string) {
    setLogs((current) => [createLog(level, message), ...current].slice(0, 24));
  }

  function updatePlcStatusSnapshot(snapshot: PlcStatusSnapshot) {
    setPlcStatus(snapshot);
    if (snapshot.lastCommand?.command === "dispatchTask" && snapshot.lastCommand.result === "ok") {
      setPlcPendingTaskNo(snapshot.currentTaskNo);
    }
  }

  function resetToBaseline(taskNo?: string) {
    if (!baselineSnapshot) return;

    clearTimers();
    generationRef.current += 1;

    const nextQueue = cloneQueue(baselineSnapshot.queue);
    const nextTask = taskNo
      ? nextQueue.find((task) => task.taskNo === taskNo) ?? cloneTask(baselineSnapshot.activeTask)
      : cloneTask(baselineSnapshot.activeTask);
    const nextRobot = {
      ...baselineSnapshot.robot,
      xColumn: nextTask?.steps[0]?.column ?? baselineSnapshot.robot.xColumn,
      zLevel: nextTask?.steps[0]?.level ?? baselineSnapshot.robot.zLevel,
      facingSide: nextTask?.steps[0]?.side ?? baselineSnapshot.robot.facingSide,
      activeSlotId: nextTask?.steps[0]?.slotId ?? null,
      activeTaskNo: nextTask?.taskNo ?? null,
      phase: "idle" as TwinMachinePhase,
      cylinderExtended: false,
      vacuumOn: false,
    };

    const nextLogs = buildReplayLogs(nextTask);
    activeTaskRef.current = nextTask;

    setQueue(updateQueueFromTask(nextQueue, nextTask, nextTask?.status === "completed" ? "completed" : nextTask?.status ?? "pending"));
    setActiveTask(nextTask);
    setSlots(cloneSlots(baselineSnapshot.slots));
    setRobot(nextRobot);
    setTransferBin([]);
    setLogs(nextLogs);
    setSelectedSlotId(nextTask?.steps[0]?.slotId ?? null);
    setSimulationStatus("idle");
    setAlarmMessage(null);
  }

  function buildReplayLogs(task: TwinQueueTask | null) {
    const base = [
      createLog("success", "数字孪生场景已重置，等待任务开始。"),
    ];

    if (task?.steps[0]) {
      base.unshift(
        createLog("info", `已聚焦任务 ${task.taskNo}，目标 ${sideLabel(task.steps[0].side)}侧 ${task.steps[0].column} 列 ${task.steps[0].level} 层。`),
      );
    }

    return base;
  }

  function handleSelectTask(taskNo: string) {
    const nextTask = queue.find((task) => task.taskNo === taskNo);
    if (!nextTask || !baselineSnapshot || !robot) return;

    clearTimers();
    generationRef.current += 1;

    const baselineQueue = cloneQueue(baselineSnapshot.queue);
    const selectedTask = baselineQueue.find((task) => task.taskNo === taskNo) ?? cloneTask(baselineSnapshot.activeTask);
    const selectedRobot = {
      ...baselineSnapshot.robot,
      xColumn: selectedTask?.steps[0]?.column ?? baselineSnapshot.robot.xColumn,
      zLevel: selectedTask?.steps[0]?.level ?? baselineSnapshot.robot.zLevel,
      facingSide: selectedTask?.steps[0]?.side ?? baselineSnapshot.robot.facingSide,
      activeSlotId: selectedTask?.steps[0]?.slotId ?? null,
      activeTaskNo: selectedTask?.taskNo ?? null,
      phase: "idle" as TwinMachinePhase,
      cylinderExtended: false,
      vacuumOn: false,
    };
    const nextLogs = [
      createLog("info", `已切换任务 ${taskNo}，等待开始。`),
      ...buildReplayLogs(selectedTask),
    ];

    activeTaskRef.current = selectedTask;
    setQueue(updateQueueFromTask(baselineQueue, selectedTask, selectedTask?.status === "completed" ? "completed" : selectedTask?.status ?? "pending"));
    setActiveTask(selectedTask);
    const nextSlots = cloneSlots(baselineSnapshot.slots);
    slotsRef.current = nextSlots;
    setSlots(nextSlots);
    setRobot(selectedRobot);
    setTransferBin([]);
    setLogs(nextLogs.slice(0, 24));
    setSelectedSlotId(selectedTask?.steps[0]?.slotId ?? null);
    setSimulationStatus("idle");
    setAlarmMessage(null);
  }

  async function runPlcCommand(command: "dispatchTask" | "start" | "pause" | "resume" | "reset") {
    if (mode !== "plc") return;

    const selectedTask = activeTaskRef.current;
    if (!selectedTask && command !== "reset") {
      pushLog("warning", "当前没有可执行任务。");
      return;
    }

    try {
      setPlcCommandBusy(true);
      const request = command === "dispatchTask"
        ? {
            command,
            task: buildDispatchTaskPayload(selectedTask!),
          }
        : { command };
      const snapshot = await sendPlcCommand(request);
      updatePlcStatusSnapshot(snapshot);

      if (command === "dispatchTask") {
        setPlcPendingTaskNo(selectedTask?.taskNo ?? null);
        pushLog("success", `任务 ${selectedTask?.taskNo ?? "--"} 已成功下发至 PLC。`);
      } else if (command === "start") {
        pushLog("info", `PLC 已接受开始命令，当前任务 ${selectedTask?.taskNo ?? "--"}。`);
      } else if (command === "pause") {
        pushLog("warning", "PLC 已接受暂停命令。");
      } else if (command === "resume") {
        pushLog("info", "PLC 已接受继续命令。");
      } else {
        pushLog("info", "PLC 已接受复位命令。");
        setPlcPendingTaskNo(null);
      }
    } catch (error) {
      if (error instanceof PlcApiError) {
        if (error.snapshot) {
          updatePlcStatusSnapshot(error.snapshot);
        }
        pushLog("error", error.message);
        setAlarmMessage(error.message);
      } else {
        pushLog("error", error instanceof Error ? error.message : "PLC 命令执行失败");
      }
    } finally {
      setPlcCommandBusy(false);
    }
  }

  function handleSelectStep(step: TwinPickStep) {
    setSelectedSlotId(step.slotId);
    pushLog("info", `已聚焦 ${step.productName}，目标 ${sideLabel(step.side)}侧 ${step.column} 列 ${step.level} 层。`);
  }

  function handleSelectSlot(slotId: string) {
    setSelectedSlotId(slotId);
  }

  function commitAlarm(message: string, step?: TwinPickStep) {
    clearTimers();
    generationRef.current += 1;
    setSimulationStatus("alarm");
    setAlarmMessage(message);
    setRobot((current) => current ? { ...current, phase: "alarm" } : current);
    setActiveTask((current) => {
      const nextTask = step ? setTaskStepStatus(current, step.id, "error") : current;
      activeTaskRef.current = nextTask;
      return nextTask;
    });
    pushLog("error", message);
  }

  function scheduleStep(step: TwinPickStep) {
    const generation = generationRef.current;
    const speed = playbackSpeedRef.current;
    const currentSlot = slotsRef.current.find((entry) => entry.id === step.slotId);

    if (!currentSlot) {
      commitAlarm(`任务 ${step.taskNo} 缺少库位映射，执行已停止。`, step);
      return;
    }

    if (currentSlot.stockQty < step.quantity) {
      commitAlarm(
        `${sideLabel(step.side)}侧 ${step.column} 列 ${step.level} 层库存不足，当前库存 ${currentSlot.stockQty}，需求 ${step.quantity}。`,
        step,
      );
      return;
    }

    setSelectedSlotId(step.slotId);
    const activeTaskState = setTaskStepStatus(activeTaskRef.current, step.id, "active");
    activeTaskRef.current = activeTaskState;
    setActiveTask(activeTaskState);

    const startedLogTimer = window.setTimeout(() => {
      if (generation !== generationRef.current) return;
      pushLog("info", `定位 ${sideLabel(step.side)}侧 ${step.column} 列 ${step.level} 层，准备抓取 ${step.productName} ×${step.quantity}。`);
    }, 10);

    timersRef.current.push(startedLogTimer);

    let cursor = 0;
    TIMELINE.forEach(({ phase, duration }) => {
      const timer = window.setTimeout(() => {
        if (generation !== generationRef.current) return;

        setRobot((current) => {
          if (!current) return current;

          return {
            ...current,
            xColumn: step.column,
            zLevel: step.level,
            facingSide: phase === "moving" ? current.facingSide : step.side,
            phase,
            activeSlotId: step.slotId,
            activeTaskNo: step.taskNo,
            cylinderExtended: phase === "extending" || phase === "suction",
            vacuumOn: phase === "suction",
          };
        });

        if (phase === "moving") {
          pushLog("info", `移动至${sideLabel(step.side)}侧 ${step.column} 列 ${step.level} 层。`);
        }
        if (phase === "rotating") {
          pushLog("info", `机械臂朝${sideLabel(step.side)}侧旋转到位。`);
        }
        if (phase === "suction") {
          pushLog("warning", `吸取 ${step.productName} ×${step.quantity}。`);
        }
        if (phase === "dropping") {
          pushLog("success", `${step.productName} 已掉落至中转箱。`);
        }
      }, cursor);

      timersRef.current.push(timer);
      cursor += duration / speed;
    });

    const completionTimer = window.setTimeout(() => {
      if (generation !== generationRef.current) return;

      const updatedSlots = slotsRef.current.map((entry) => (
        entry.id === step.slotId
          ? (() => {
              const nextStockQty = Math.max(entry.stockQty - step.quantity, 0);
              return {
                ...entry,
                stockQty: nextStockQty,
                status: resolveSlotStatus(nextStockQty),
              };
            })()
          : entry
      ));
      slotsRef.current = updatedSlots;
      setSlots(updatedSlots);

      setTransferBin((current) => [
        {
          productCode: step.productCode,
          productName: step.productName,
          quantity: step.quantity,
          pickedAt: formatTime(new Date()),
        },
        ...current,
      ]);

      const nextTask = setTaskStepStatus(activeTaskRef.current, step.id, "completed");
      const completed = nextTask ? countCompletedSteps(nextTask) >= nextTask.steps.length : false;
      const nextStatus: TwinQueueTaskStatus = completed ? "completed" : "picking";
      const updatedTask = nextTask ? {
        ...nextTask,
        status: nextStatus,
        completedSteps: countCompletedSteps(nextTask),
      } : null;
      activeTaskRef.current = updatedTask;
      setActiveTask(updatedTask);
      setQueue((current) => updateQueueFromTask(current, updatedTask, nextStatus));

      setRobot((current) => current ? {
        ...current,
        phase: "idle",
        facingSide: step.side,
        cylinderExtended: false,
        vacuumOn: false,
      } : current);

      const stepDelay = window.setTimeout(() => {
        if (generation !== generationRef.current) return;
        const nextTask = activeTaskRef.current ? {
          ...activeTaskRef.current,
          completedSteps: countCompletedSteps(activeTaskRef.current),
        } : null;
        const nextStep = currentStep(nextTask);

        if (!nextStep) {
          setSimulationStatus("completed");
          setRobot((current) => current ? { ...current, phase: "completed" } : current);
          pushLog("success", `任务 ${step.taskNo} 已完成，订单全部明细已落入中转箱。`);
          return;
        }

        scheduleStep(nextStep);
      }, STEP_INTERVAL / speed);

      timersRef.current.push(stepDelay);
    }, cursor);

    timersRef.current.push(completionTimer);
  }

  function handleStart() {
    if (mode === "plc") {
      void runPlcCommand("start");
      return;
    }

    const nextStep = currentStep(activeTaskRef.current);
    if (!nextStep) {
      setSimulationStatus("completed");
      setRobot((current) => current ? { ...current, phase: "completed" } : current);
      return;
    }

    clearTimers();
    generationRef.current += 1;
    setSimulationStatus("running");
    setAlarmMessage(null);
    scheduleStep(nextStep);
  }

  function handlePause() {
    if (mode === "plc") {
      void runPlcCommand("pause");
      return;
    }

    clearTimers();
    generationRef.current += 1;
    setSimulationStatus("paused");
    setRobot((current) => current ? { ...current, phase: "paused", vacuumOn: false, cylinderExtended: false } : current);
    pushLog("warning", "执行已暂停。");
  }

  function handleResume() {
    if (mode === "plc") {
      void runPlcCommand("resume");
      return;
    }

    const nextStep = currentStep(activeTaskRef.current);
    if (!nextStep) {
      setSimulationStatus("completed");
      return;
    }

    const resumedTask = resetTaskStepStatus(activeTaskRef.current, nextStep.id, "pending");
    activeTaskRef.current = resumedTask;
    setActiveTask(resumedTask);

    pushLog("info", "继续执行当前聚合步骤。");
    handleStart();
  }

  function handleReplay() {
    if (mode === "plc") {
      void runPlcCommand("reset");
      return;
    }

    if (!activeTaskRef.current && !baselineSnapshot?.activeTask) return;
    resetToBaseline(activeTaskRef.current?.taskNo ?? baselineSnapshot?.activeTask?.taskNo);
  }

  if (loading || !baselineSnapshot || !config || !robot) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-3xl border border-border/70 bg-card/70 px-6 py-10 text-sm text-muted-foreground">
          正在加载数字孪生场景…
        </div>
      </div>
    );
  }

  const headerTask = activeTask?.taskNo ?? "--";
  const completedSteps = countCompletedSteps(activeTask);
  const totalSteps = activeTask?.steps.length ?? 0;
  const headerPhase = mode === "simulation" ? phaseLabel(robot.phase) : plcStateLabel(plcStatus.machineState);
  const headerPhaseTone = mode === "simulation" ? statusTone(simulationStatus) : plcStatusTone(plcStatus.machineState);
  const modeBadgeLabel = mode === "simulation" ? "模拟模式" : "PLC 联机模式";
  const modeBadgeTone = mode === "simulation"
    ? "bg-blue-500/12 text-blue-700 dark:text-blue-300"
    : plcStatus.configured
      ? plcStatus.connected
        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
        : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
      : "bg-slate-500/12 text-slate-700 dark:text-slate-300";
  const actionableQueueCount = queue.filter((task) => task.status === "pending" || task.status === "picking").length;
  const transferTotal = totalPickedQuantity(transferBin);
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const stageTargetLabel = activeStep
    ? `${sideLabel(activeStep.side)}侧 ${activeStep.column} 列 ${activeStep.level} 层`
    : "当前任务已完成";
  const focusSlotLabel = selectedSlot
    ? `${sideLabel(selectedSlot.side)}-${selectedSlot.column}-${selectedSlot.level}`
    : "未聚焦库位";
  const focusSlotDescription = selectedSlot?.productName ?? "点击舞台库位或步骤明细查看详情";
  const runtimeCaption = mode === "simulation"
    ? simulationStatus === "running"
      ? "仿真正在推进当前任务。"
      : simulationStatus === "paused"
        ? "仿真已暂停，随时可以继续。"
        : simulationStatus === "completed"
          ? "当前任务已经执行完成。"
          : simulationStatus === "alarm"
            ? "仿真已停止，请查看异常提示。"
            : "仿真已就绪，等待任务开始。"
    : !plcStatus.configured
      ? "尚未配置 PLC 连接。"
      : plcStatus.connected
        ? "PLC 在线，可下发与执行任务。"
        : "PLC 当前离线，请检查链路状态。";
  const runtimeDetail = mode === "simulation"
    ? `当前播放速度 ${playbackSpeed}x`
    : `当前 PLC 任务 ${plcStatus.currentTaskNo ?? "--"}`;
  const queueBadge = `${actionableQueueCount} 条待执行`;
  const stepBadge = activeTask ? `${completedSteps}/${totalSteps} 步` : "无任务";
  const logBadge = `${logs.length} 条记录`;
  const queueDescription = activeTask
    ? `当前聚焦 ${headerTask}，可切换任务或查看步骤明细。`
    : "从任务队列中选择一个任务并开始执行。";

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.82)_48%,rgba(255,255,255,0.98))] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[1820px] flex-col gap-5">
        <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] shadow-[0_24px_64px_-40px_rgba(15,23,42,0.45)] backdrop-blur-sm">
          <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn("gap-1.5", modeBadgeTone)}>
                  <Radar className="size-3" />
                  {modeBadgeLabel}
                </Badge>
                <Badge variant="outline">立库出库系统</Badge>
                <Badge variant="outline">单巷道上下双排货架</Badge>
                {mode === "plc" ? (
                  <Badge variant="outline">
                    {!plcStatus.configured ? "未配置" : plcStatus.connected ? "PLC 在线" : "PLC 离线"}
                  </Badge>
                ) : (
                  <Badge variant="outline">仿真沙盘</Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">数字孪生运行中心</h1>
                  <p className="max-w-2xl pb-1 text-sm text-muted-foreground">
                    把任务、机械臂、库位焦点和执行日志收束到一个主视区里，减少在多个面板之间来回切换。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={mode === "simulation" ? "default" : "outline"} size="sm" onClick={() => setMode("simulation")}>
                    模拟模式
                  </Button>
                  <Button variant={mode === "plc" ? "default" : "outline"} size="sm" onClick={() => setMode("plc")}>
                    PLC 模式
                  </Button>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-white/70 px-4 py-4 shadow-sm shadow-slate-950/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                      运行概览
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{runtimeCaption}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{runtimeDetail}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2 text-right">
                    <p className="text-[11px] text-muted-foreground">当前任务</p>
                    <p className="mt-1 font-mono text-sm font-semibold">{headerTask}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {activeStep
                        ? `当前目标 ${stageTargetLabel} · ${activeStep.productName} ×${activeStep.quantity}`
                        : "当前没有待执行步骤"}
                    </span>
                    <span className="font-medium text-foreground">{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(37,99,235,0.85),rgba(14,165,233,0.75))] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 shadow-sm shadow-slate-950/5">
                <p className="text-xs text-muted-foreground">当前设备相位</p>
                <p className={cn("mt-2 text-xl font-semibold", headerPhaseTone)}>{headerPhase}</p>
                <p className="mt-1 text-xs text-muted-foreground">{mode === "simulation" ? "机械臂实时动画状态" : "PLC 返回的设备状态"}</p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 shadow-sm shadow-slate-950/5">
                <p className="text-xs text-muted-foreground">订单步骤进度</p>
                <p className="mt-2 text-xl font-semibold">{completedSteps}/{totalSteps}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalSteps > 0 ? `已完成 ${progressPercent}%` : "等待选择任务"}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 shadow-sm shadow-slate-950/5">
                <p className="text-xs text-muted-foreground">执行队列</p>
                <p className="mt-2 text-xl font-semibold">{actionableQueueCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">待执行与执行中任务总数</p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 shadow-sm shadow-slate-950/5">
                <p className="text-xs text-muted-foreground">中转箱累计</p>
                <p className="mt-2 text-xl font-semibold">{transferTotal}</p>
                <p className="mt-1 text-xs text-muted-foreground">已按 SKU 聚合完成的件数</p>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/92 shadow-[0_24px_64px_-44px_rgba(15,23,42,0.4)] backdrop-blur-sm">
            <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:px-6 xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                  <Radar className="size-3.5" />
                  执行舞台
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">机械臂与货架主视图</h2>
                  <p className="max-w-2xl pb-1 text-sm text-muted-foreground">
                    当前目标、运行相位和库位聚焦保持在同一视觉中心，便于连续观察执行过程。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
                  <p className="text-xs text-muted-foreground">当前目标</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{stageTargetLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeStep ? `${activeStep.productName} ×${activeStep.quantity}` : "可切换任务或重播"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
                  <p className="text-xs text-muted-foreground">焦点库位</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{focusSlotLabel}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{focusSlotDescription}</p>
                </div>
              </div>
            </div>

            <div className="px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
              <TwinStage
                config={config}
                slots={slots}
                robot={robot}
                playbackSpeed={playbackSpeed}
                activeStep={activeStep}
                focusedSlotId={selectedSlotId}
                onSelectSlot={handleSelectSlot}
              />
            </div>

            <div className="grid gap-3 border-t border-border/70 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRightLeft className="size-4" />
                  <span className="text-xs font-medium">货架规模</span>
                </div>
                <p className="mt-2 text-lg font-semibold">480 个库位</p>
                <p className="mt-1 text-xs text-muted-foreground">30 列 × 8 层，上下双排</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gauge className="size-4" />
                  <span className="text-xs font-medium">轨道参数</span>
                </div>
                <p className="mt-2 text-lg font-semibold">X 轴 5m / Z 轴 2m</p>
                <p className="mt-1 text-xs text-muted-foreground">单巷道桁架机械臂执行范围</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Cable className="size-4" />
                  <span className="text-xs font-medium">{mode === "simulation" ? "仿真参数" : "PLC 状态"}</span>
                </div>
                <p className="mt-2 text-lg font-semibold">
                  {mode === "simulation" ? `${playbackSpeed}x 播放速度` : !plcStatus.configured ? "未配置" : plcStatus.connected ? "在线" : "离线"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{runtimeDetail}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Boxes className="size-4" />
                  <span className="text-xs font-medium">执行节拍</span>
                </div>
                <p className="mt-2 text-lg font-semibold">{actionableQueueCount} 条任务待观察</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeTask ? `当前聚焦 ${activeTask.taskNo}` : "从下方任务工作台选择任务"}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <TwinQueuePanel
              mode={mode}
              activeTask={activeTask}
              robot={robot}
              simulationStatus={simulationStatus}
              plcStatus={plcStatus}
              plcPendingTaskNo={plcPendingTaskNo}
              plcCommandBusy={plcCommandBusy}
              selectedSlot={selectedSlot}
              playbackSpeed={playbackSpeed}
              onDispatchTask={() => void runPlcCommand("dispatchTask")}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onReplay={handleReplay}
              onSpeedChange={setPlaybackSpeed}
            />
            <TwinDetailPanel
              activeTask={activeTask}
              selectedSlot={selectedSlot}
              transferBin={transferBin}
              alarmMessage={alarmMessage}
            />
          </div>

          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">底部工作台</p>
              <h2 className="text-2xl font-semibold tracking-tight">队列、步骤与日志</h2>
              <p className="text-sm text-muted-foreground">
                辅助信息收到底部并支持折叠，主舞台上方只保留执行中真正需要持续观察的内容。
              </p>
            </div>

            <div className="space-y-3">
              <FoldSection
                title="任务队列"
                description={queueDescription}
                badge={queueBadge}
                icon={ListTree}
                defaultOpen
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {queue.filter((task) => task.status === "pending" || task.status === "picking").map((task) => {
                    const isActive = activeTask?.taskNo === task.taskNo;

                    return (
                      <button
                        key={task.taskNo}
                        type="button"
                        onClick={() => handleSelectTask(task.taskNo)}
                        className={cn(
                          "w-full rounded-[22px] border px-4 py-4 text-left transition-all",
                          isActive
                            ? "border-blue-500/50 bg-blue-500/8 shadow-sm shadow-blue-500/10"
                            : "border-border/70 bg-background/65 hover:border-foreground/20 hover:bg-muted/35",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-xs font-semibold">{task.taskNo}</p>
                              <Badge variant={task.status === "picking" ? "secondary" : "outline"} className="text-[10px]">
                                {task.status === "picking" ? "拣货中" : "待执行"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{task.orderNo}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{task.totalQuantity}</p>
                            <p className="text-[11px] text-muted-foreground">件</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{task.operator ?? "系统调度"}</span>
                          <span>{task.createdAt.slice(5, 16)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FoldSection>

              <FoldSection
                title="步骤明细"
                description={activeTask ? `当前任务 ${headerTask} 的聚合步骤明细。` : "当前没有可查看的任务步骤。"}
                badge={stepBadge}
                icon={ScanSearch}
                defaultOpen
              >
                {activeTask ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {activeTask.steps.map((step, index) => {
                      const isCurrent = step.status === "active";
                      const isDone = step.status === "completed";

                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => handleSelectStep(step)}
                          className={cn(
                            "w-full rounded-[22px] border px-4 py-4 text-left transition-all",
                            isCurrent
                              ? "border-amber-500/50 bg-amber-500/8"
                              : isDone
                                ? "border-emerald-500/35 bg-emerald-500/8"
                                : "border-border/70 bg-background/65 hover:border-foreground/20 hover:bg-muted/35",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{step.productName}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {sideLabel(step.side)}侧 {step.column} 列 {step.level} 层
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">×{step.quantity}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {isDone ? "已完成" : isCurrent ? "执行中" : `步骤 ${index + 1}`}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                    当前没有可展示的任务
                  </div>
                )}
              </FoldSection>

              <FoldSection
                title="动作日志"
                description="关键动作按时间顺序记录，可在需要时再展开查看。"
                badge={logBadge}
                icon={TimerReset}
              >
                <div className="space-y-2">
                  {logs.map((entry) => (
                    <div key={entry.id} className="flex gap-3 rounded-[22px] border border-border/70 bg-background/65 px-4 py-3">
                      <div className="flex w-14 shrink-0 items-start justify-end pt-0.5 text-[11px] text-muted-foreground">
                        {entry.timestamp}
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <Dot
                          className={cn(
                            "mt-[1px] size-5 shrink-0",
                            entry.level === "success"
                              ? "text-emerald-500"
                              : entry.level === "warning"
                                ? "text-amber-500"
                                : entry.level === "error"
                                  ? "text-red-500"
                                  : "text-blue-500",
                          )}
                        />
                        <p className="text-sm text-foreground">{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </FoldSection>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
