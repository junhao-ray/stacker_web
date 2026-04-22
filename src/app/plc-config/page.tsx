"use client";

import { useEffect, useState } from "react";
import {
  Cable,
  CheckCircle2,
  Download,
  FileCog,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Zap,
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
        if (ignore) return;
        setError(loadError instanceof Error ? loadError.message : "配置读取失败");
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

  function updateStepField(index: number, key: keyof PlcGatewayConfigFormValue["nodes"]["task"]["steps"][number], value: string) {
    setForm((current) => {
      const next = clonePlcGatewayConfigFormValue(current);
      next.nodes.task.steps[index][key] = value;
      return next;
    });
  }

  function addStepTemplate() {
    setForm((current) => {
      const next = clonePlcGatewayConfigFormValue(current);
      next.nodes.task.steps.push({
        index: "",
        productCode: "",
        quantity: "",
        side: "",
        column: "",
        level: "",
        slotId: "",
      });
      return next;
    });
  }

  function removeStepTemplate(index: number) {
    setForm((current) => {
      const next = clonePlcGatewayConfigFormValue(current);
      if (next.nodes.task.steps.length === 1) {
        next.nodes.task.steps[0] = {
          index: "",
          productCode: "",
          quantity: "",
          side: "",
          column: "",
          level: "",
          slotId: "",
        };
      } else {
        next.nodes.task.steps.splice(index, 1);
      }
      return next;
    });
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
      setMessage("PLC / OPC 配置已保存。重启或热重载网关后即可生效。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "配置保存失败");
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
      setError(testError instanceof Error ? testError.message : "配置测试失败");
    } finally {
      setTesting(false);
    }
  }

  async function handleResetToTemplate() {
    try {
      const template = await fetchPlcTemplateConfig();
      setForm(clonePlcGatewayConfigFormValue(template.value));
      setMessage("已恢复为模板默认值，尚未保存到正式配置文件。");
      setError(null);
      setTestResult(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "读取模板配置失败");
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
          正在加载 PLC / OPC 配置…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[linear-gradient(180deg,rgba(241,245,249,0.65),transparent)] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-6">
        <div className="rounded-[28px] border border-border/70 bg-card/90 px-5 py-5 shadow-sm shadow-slate-950/3 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <Cable className="size-3" />
                  PLC / OPC 配置
                </Badge>
                <Badge variant="outline">{configExists ? "已存在正式配置" : "当前使用模板默认值"}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">PLC 联机配置</h1>
                <p className="pb-0.5 text-sm text-muted-foreground">
                  维护 OPC UA 连接参数、命令码和 NodeId 映射
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                当前配置文件：<span className="font-mono text-foreground">{configPath || "--"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleTestConnection} disabled={testing} size="lg" variant="outline" className="gap-2">
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                {testing ? "测试中…" : "测试配置"}
              </Button>
              <Button onClick={handleResetToTemplate} size="lg" variant="outline" className="gap-2">
                <RotateCcw className="size-4" />
                恢复模板
              </Button>
              <Button onClick={handleExportJson} size="lg" variant="outline" className="gap-2">
                <Download className="size-4" />
                导出 JSON
              </Button>
              <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "保存中…" : "保存配置"}
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
              <p className="font-medium">{testResult.ok ? "连接测试通过" : "连接测试失败"}</p>
              <p className="mt-1">{testResult.message}</p>
              <p className="mt-2 text-xs opacity-80">检查时间：{new Date(testResult.checkedAt).toLocaleString("zh-CN")}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={Server}
                  title="连接参数"
                  description="配置 OPC UA 服务地址、安全策略和重连相关参数。"
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
                  <Input value={form.endpointUrl} onChange={(event) => updateStringField("endpointUrl", event.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Security Mode</label>
                  <Select
                    value={form.securityMode}
                    onValueChange={(value) => updateStringField("securityMode", value ?? "None")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLC_SECURITY_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Security Policy</label>
                  <Select
                    value={form.securityPolicy}
                    onValueChange={(value) => updateStringField("securityPolicy", value ?? "None")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLC_SECURITY_POLICIES.map((policy) => (
                        <SelectItem key={policy} value={policy}>{policy}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Session Timeout (ms)</label>
                  <Input type="number" value={String(form.requestedSessionTimeoutMs)} onChange={(event) => updateNumberField("requestedSessionTimeoutMs", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ACK Timeout (ms)</label>
                  <Input type="number" value={String(form.ackTimeoutMs)} onChange={(event) => updateNumberField("ackTimeoutMs", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Reconnect Interval (ms)</label>
                  <Input type="number" value={String(form.reconnectIntervalMs)} onChange={(event) => updateNumberField("reconnectIntervalMs", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Pulse Duration (ms)</label>
                  <Input type="number" value={String(form.pulseDurationMs)} onChange={(event) => updateNumberField("pulseDurationMs", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Poll Interval (ms)</label>
                  <Input type="number" value={String(form.pollIntervalMs)} onChange={(event) => updateNumberField("pollIntervalMs", event.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={ShieldCheck}
                  title="命令码与方向编码"
                  description="定义业务命令到 PLC 数值的映射，前端不硬编码这些值。"
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">左侧编码</label>
                  <Input type="number" value={String(form.sideMapping.left)} onChange={(event) => updateNumberField("sideMapping.left", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">右侧编码</label>
                  <Input type="number" value={String(form.sideMapping.right)} onChange={(event) => updateNumberField("sideMapping.right", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">dispatchTask</label>
                  <Input type="number" value={String(form.commandCodes.dispatchTask)} onChange={(event) => updateNumberField("commandCodes.dispatchTask", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">start</label>
                  <Input type="number" value={String(form.commandCodes.start)} onChange={(event) => updateNumberField("commandCodes.start", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">pause</label>
                  <Input type="number" value={String(form.commandCodes.pause)} onChange={(event) => updateNumberField("commandCodes.pause", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">resume</label>
                  <Input type="number" value={String(form.commandCodes.resume)} onChange={(event) => updateNumberField("commandCodes.resume", event.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">reset</label>
                  <Input type="number" value={String(form.commandCodes.reset)} onChange={(event) => updateNumberField("commandCodes.reset", event.target.value)} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <SectionHeader
                  icon={FileCog}
                  title="命令 / ACK / 设备状态点位"
                  description="这里填写 PLC 对应的 NodeId。未填写时，网关会保持 configured=false。"
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">命令码 NodeId</label>
                  <Input value={form.nodes.command.code} onChange={(event) => updateStringField("nodes.command.code", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">命令序号 NodeId</label>
                  <Input value={form.nodes.command.seq} onChange={(event) => updateStringField("nodes.command.seq", event.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">触发位 NodeId</label>
                  <Input value={form.nodes.command.trigger} onChange={(event) => updateStringField("nodes.command.trigger", event.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ACK Seq NodeId</label>
                  <Input value={form.nodes.ack.lastAckSeq} onChange={(event) => updateStringField("nodes.ack.lastAckSeq", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ACK Code NodeId</label>
                  <Input value={form.nodes.ack.lastAckCode} onChange={(event) => updateStringField("nodes.ack.lastAckCode", event.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">ACK Result NodeId</label>
                  <Input value={form.nodes.ack.lastAckResult} onChange={(event) => updateStringField("nodes.ack.lastAckResult", event.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">设备状态 NodeId</label>
                  <Input value={form.nodes.machine.state} onChange={(event) => updateStringField("nodes.machine.state", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">当前任务号 NodeId</label>
                  <Input value={form.nodes.machine.currentTaskNo} onChange={(event) => updateStringField("nodes.machine.currentTaskNo", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">告警位 NodeId</label>
                  <Input value={form.nodes.machine.alarm} onChange={(event) => updateStringField("nodes.machine.alarm", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">错误码 NodeId</label>
                  <Input value={form.nodes.machine.errorCode} onChange={(event) => updateStringField("nodes.machine.errorCode", event.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">错误信息 NodeId</label>
                  <Input value={form.nodes.machine.errorMessage} onChange={(event) => updateStringField("nodes.machine.errorMessage", event.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <SectionHeader
                    icon={Cable}
                    title="任务载荷点位模板"
                    description="为 `dispatchTask` 定义任务头和步骤数组的固定写入模板。"
                  />
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={addStepTemplate}>
                  <Plus className="size-3.5" />
                  新增步骤模板
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">TaskNo NodeId</label>
                    <Input value={form.nodes.task.header.taskNo} onChange={(event) => updateStringField("nodes.task.header.taskNo", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">OrderNo NodeId</label>
                    <Input value={form.nodes.task.header.orderNo} onChange={(event) => updateStringField("nodes.task.header.orderNo", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">StepCount NodeId</label>
                    <Input value={form.nodes.task.header.stepCount} onChange={(event) => updateStringField("nodes.task.header.stepCount", event.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  {form.nodes.task.steps.map((step, index) => (
                    <div key={`step-template-${index}`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">步骤模板 {index + 1}</p>
                          <p className="text-xs text-muted-foreground">对应固定长度数组中的第 {index + 1} 个槽位</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => removeStepTemplate(index)}>
                          <Trash2 className="size-3.5" />
                          删除
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Input value={step.index} onChange={(event) => updateStepField(index, "index", event.target.value)} placeholder="index NodeId" />
                        <Input value={step.productCode} onChange={(event) => updateStepField(index, "productCode", event.target.value)} placeholder="productCode NodeId" />
                        <Input value={step.quantity} onChange={(event) => updateStepField(index, "quantity", event.target.value)} placeholder="quantity NodeId" />
                        <Input value={step.side} onChange={(event) => updateStepField(index, "side", event.target.value)} placeholder="side NodeId" />
                        <Input value={step.column} onChange={(event) => updateStepField(index, "column", event.target.value)} placeholder="column NodeId" />
                        <Input value={step.level} onChange={(event) => updateStepField(index, "level", event.target.value)} placeholder="level NodeId" />
                        <div className="md:col-span-2">
                          <Input value={step.slotId} onChange={(event) => updateStepField(index, "slotId", event.target.value)} placeholder="slotId NodeId" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
