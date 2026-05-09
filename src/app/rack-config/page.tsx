"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Warehouse,
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
import { SEED_SPECS } from "@/lib/mock-data";
import {
  cloneRackConfig,
  createDefaultRackConfig,
  getRackLevelLayouts,
  normalizeRackConfig,
  validateRackConfig,
} from "@/lib/rack-config";
import {
  RackConfigApiError,
  fetchRackConfig,
  saveRackConfig,
} from "@/lib/rack-config-client";
import type {
  TwinRackConfig,
  TwinRackLevelItemConfig,
  TwinSide,
} from "@/lib/types";

const SIDE_LABELS: Record<TwinSide, string> = {
  left: "上侧货架",
  right: "下侧货架",
};

function specLabel(specId: number) {
  const spec = SEED_SPECS.find((entry) => entry.id === specId);
  return spec ? `${spec.name} · ${spec.width}mm` : `规格 ${specId}`;
}

function getSpecWidth(specId: number) {
  return SEED_SPECS.find((entry) => entry.id === specId)?.width ?? 0;
}

function makeItemId(side: TwinSide, level: number) {
  return `${side}-${level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

function findLevel(config: TwinRackConfig, side: TwinSide, level: number) {
  return config.sides.find((entry) => entry.side === side)?.levels.find((entry) => entry.level === level);
}

export default function RackConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [configExists, setConfigExists] = useState(false);
  const [form, setForm] = useState<TwinRackConfig>(() => createDefaultRackConfig());
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setErrors([]);
      try {
        const payload = await fetchRackConfig();
        if (ignore) return;
        setConfigPath(payload.path);
        setConfigExists(payload.exists);
        setForm(cloneRackConfig(payload.value));
      } catch (error) {
        if (!ignore) {
          setErrors([error instanceof Error ? error.message : "货架配置加载失败"]);
          setForm(createDefaultRackConfig());
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  const layouts = useMemo(() => getRackLevelLayouts(form), [form]);
  const validationErrors = useMemo(() => validateRackConfig(form), [form]);
  const totalSlots = layouts.reduce((sum, layout) => sum + layout.slotCount, 0);
  const overflowCount = layouts.filter((layout) => layout.overflowMm > 0).length;

  function updateNumberField(field: "rackLengthMm" | "rackHeightMm" | "rackLevels" | "defaultGapMm", value: string) {
    const numericValue = Number(value);
    setForm((current) => normalizeRackConfig({
      ...current,
      [field]: Number.isFinite(numericValue) ? numericValue : 0,
    }));
  }

  function updateLevelItems(side: TwinSide, level: number, updater: (items: TwinRackLevelItemConfig[]) => TwinRackLevelItemConfig[]) {
    setForm((current) => {
      const next = cloneRackConfig(current);
      const levelConfig = findLevel(next, side, level);
      if (!levelConfig) return current;
      levelConfig.items = updater(levelConfig.items.map((item) => ({ ...item })));
      return normalizeRackConfig(next);
    });
  }

  function updateItem(side: TwinSide, level: number, itemId: string, patch: Partial<TwinRackLevelItemConfig>) {
    updateLevelItems(side, level, (items) => items.map((item) => (
      item.id === itemId ? { ...item, ...patch } : item
    )));
  }

  function addItem(side: TwinSide, level: number) {
    updateLevelItems(side, level, (items) => [
      ...items,
      {
        id: makeItemId(side, level),
        specId: SEED_SPECS[0]?.id ?? 1,
        quantity: 1,
      },
    ]);
  }

  function removeItem(side: TwinSide, level: number, itemId: string) {
    updateLevelItems(side, level, (items) => items.filter((item) => item.id !== itemId));
  }

  function moveItem(side: TwinSide, level: number, itemId: string, direction: -1 | 1) {
    updateLevelItems(side, level, (items) => {
      const index = items.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function handleSave() {
    const nextErrors = validateRackConfig(form);
    setErrors(nextErrors);
    setMessage(null);
    if (nextErrors.length > 0) return;

    setSaving(true);
    try {
      const payload = await saveRackConfig(form);
      setConfigPath(payload.path);
      setConfigExists(payload.exists);
      setForm(cloneRackConfig(payload.value));
      setMessage("货架配置已保存，刷新数字孪生页面后生效。");
    } catch (error) {
      if (error instanceof RackConfigApiError) {
        setErrors(error.errors.length > 0 ? error.errors : [error.message]);
      } else {
        setErrors([error instanceof Error ? error.message : "货架配置保存失败"]);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefault() {
    setForm(createDefaultRackConfig());
    setErrors([]);
    setMessage("已恢复默认货架配置，尚未保存。");
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-3xl border border-border/70 bg-card/80 px-6 py-12 text-sm text-muted-foreground">
          正在加载货架配置...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[linear-gradient(180deg,rgba(241,245,249,0.7),transparent)] p-4 sm:p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.48),transparent)]">
      <div className="mx-auto flex max-w-[1720px] flex-col gap-6">
        <section className="rounded-[28px] border border-border/70 bg-card/90 px-5 py-5 shadow-sm shadow-slate-950/4 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 bg-blue-500/12 text-blue-700 dark:text-blue-300">
                  <Warehouse className="size-3" />
                  货架配置
                </Badge>
                <Badge variant="outline">{configExists ? "已保存配置" : "默认配置"}</Badge>
                <Badge variant={overflowCount > 0 ? "destructive" : "outline"}>
                  {overflowCount > 0 ? `${overflowCount} 层超限` : "容量正常"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">数字孪生货架配置</h1>
                <p className="pb-0.5 text-sm text-muted-foreground">
                  配置上下双排货架的四层混放种子袋，系统按袋宽自动展开库位。
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                配置文件：<span className="font-mono text-foreground">{configPath || "--"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleResetDefault} size="lg" variant="outline" className="gap-2">
                <RotateCcw className="size-4" />
                默认配置
              </Button>
              <Button onClick={handleSave} disabled={saving || validationErrors.length > 0} size="lg" className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "保存中" : "保存配置"}
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

          {(errors.length > 0 || validationErrors.length > 0) ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {[...new Set([...errors, ...validationErrors])].map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/90">
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Boxes className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{totalSlots}</p>
                <p className="text-xs text-muted-foreground">总库位</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">货架长度</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{form.rackLengthMm}mm</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">货架高度</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{form.rackHeightMm}mm</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">默认间隙</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{form.defaultGapMm}mm</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="h-fit border-border/70 bg-card/90">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Warehouse className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">基础尺寸</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                当前设备要求 1800mm × 2000mm、4 层；修改后会触发校验。
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-1.5">
                <FieldLabel>长度 mm</FieldLabel>
                <Input type="number" value={form.rackLengthMm} onChange={(event) => updateNumberField("rackLengthMm", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>高度 mm</FieldLabel>
                <Input type="number" value={form.rackHeightMm} onChange={(event) => updateNumberField("rackHeightMm", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>层数</FieldLabel>
                <Input type="number" value={form.rackLevels} onChange={(event) => updateNumberField("rackLevels", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>默认袋间间隙 mm</FieldLabel>
                <Input type="number" value={form.defaultGapMm} onChange={(event) => updateNumberField("defaultGapMm", event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {form.sides.map((sideConfig) => (
              <section key={sideConfig.side} className="rounded-[28px] border border-border/70 bg-card/90 shadow-sm shadow-slate-950/4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold">{SIDE_LABELS[sideConfig.side]}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">每层可混放多个规格，库位按顺序从左到右展开。</p>
                  </div>
                  <Badge variant="outline">{sideConfig.levels.reduce((sum, level) => sum + level.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)} 个库位</Badge>
                </div>

                <div className="grid gap-4 p-5">
                  {sideConfig.levels.map((levelConfig) => {
                    const layout = layouts.find((entry) => entry.side === sideConfig.side && entry.level === levelConfig.level);
                    const usedPercent = layout ? Math.min(100, (layout.usedLengthMm / form.rackLengthMm) * 100) : 0;
                    const isOverflow = Boolean(layout && layout.overflowMm > 0);

                    return (
                      <div key={`${sideConfig.side}-${levelConfig.level}`} className="rounded-2xl border border-border/70 bg-background/65 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{levelConfig.level} 层</h3>
                              <Badge variant={isOverflow ? "destructive" : "outline"}>
                                {layout?.slotCount ?? 0} 列
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              已用 {Math.round(layout?.usedLengthMm ?? 0)}mm · 剩余 {Math.round(layout?.remainingLengthMm ?? 0)}mm
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => addItem(sideConfig.side, levelConfig.level)} className="gap-2">
                            <Plus className="size-3.5" />
                            添加规格
                          </Button>
                        </div>

                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={isOverflow ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-blue-500"}
                            style={{ width: `${usedPercent}%` }}
                          />
                        </div>

                        <div className="mt-4 space-y-3">
                          {levelConfig.items.map((item, index) => (
                            <div key={item.id} className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 md:grid-cols-[minmax(190px,1fr)_96px_118px_auto] md:items-end">
                              <div className="space-y-1.5">
                                <FieldLabel>种子规格</FieldLabel>
                                <Select
                                  value={String(item.specId)}
                                  onValueChange={(value) => updateItem(sideConfig.side, levelConfig.level, item.id, { specId: Number(value) })}
                                >
                                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {SEED_SPECS.map((spec) => (
                                      <SelectItem key={spec.id} value={String(spec.id)}>
                                        {spec.name} · {spec.width}mm
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <FieldLabel>数量</FieldLabel>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(event) => updateItem(sideConfig.side, levelConfig.level, item.id, { quantity: Number(event.target.value) })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <FieldLabel>间隙覆盖</FieldLabel>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder={`${form.defaultGapMm}`}
                                  value={item.gapAfterMm ?? ""}
                                  onChange={(event) => updateItem(sideConfig.side, levelConfig.level, item.id, {
                                    gapAfterMm: event.target.value === "" ? undefined : Number(event.target.value),
                                  })}
                                />
                              </div>
                              <div className="flex gap-1 md:justify-end">
                                <Button size="icon" variant="ghost" onClick={() => moveItem(sideConfig.side, levelConfig.level, item.id, -1)} disabled={index === 0}>
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => moveItem(sideConfig.side, levelConfig.level, item.id, 1)} disabled={index === levelConfig.items.length - 1}>
                                  <ArrowDown className="size-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => removeItem(sideConfig.side, levelConfig.level, item.id)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                              <div className="md:col-span-4">
                                <p className="text-xs text-muted-foreground">
                                  {specLabel(item.specId)} × {item.quantity}，占用约 {item.quantity * getSpecWidth(item.specId)}mm
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
