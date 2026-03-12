"use client";

import { Ruler, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SEED_SPECS, getSpecDistribution } from "@/lib/mock-data";

export default function SpecsPage() {
  const dist = getSpecDistribution();
  const maxArea = Math.max(...SEED_SPECS.map((s) => s.width * s.length));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ── 规格表格 ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="size-4 text-muted-foreground" />
            种子包装规格表
          </CardTitle>
          <CardDescription>
            共 {SEED_SPECS.length} 种包装规格 · 数据来源：库房种子包装规格表
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 w-[60px]">序号</TableHead>
                <TableHead>薄度 (cm)</TableHead>
                <TableHead>厚度 (cm)</TableHead>
                <TableHead>宽度 (cm)</TableHead>
                <TableHead>长度 (cm)</TableHead>
                <TableHead>面积 (cm²)</TableHead>
                <TableHead>包装</TableHead>
                <TableHead className="text-right">品种数</TableHead>
                <TableHead className="text-right pr-4">库存</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SEED_SPECS.map((spec) => {
                const d = dist.find((x) => x.specId === spec.id);
                const area = spec.width * spec.length;
                return (
                  <TableRow key={spec.id}>
                    <TableCell className="pl-4 font-mono font-medium">
                      #{spec.id}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {spec.thinness || "—"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {spec.thickness}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {spec.width}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {spec.length}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {area.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          spec.packType === "罐装" ? "default" : "secondary"
                        }
                      >
                        {spec.packType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {d?.count ?? 0}
                    </TableCell>
                    <TableCell className="text-right pr-4 font-mono tabular-nums font-semibold">
                      {(d?.stock ?? 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 尺寸可视化 ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            尺寸可视化
          </CardTitle>
          <CardDescription>
            按比例展示各规格的宽×长尺寸
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {SEED_SPECS.map((spec) => {
              const area = spec.width * spec.length;
              const scale = Math.sqrt(area / maxArea);
              const maxVisualH = 120;
              const maxVisualW = 80;
              const h = Math.max(32, Math.round(maxVisualH * scale));
              const w = Math.max(24, Math.round(maxVisualW * (spec.width / 17)));

              return (
                <div
                  key={spec.id}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-secondary/50 transition-colors hover:border-primary/40 hover:bg-secondary"
                    style={{ width: `${w}px`, height: `${h}px` }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground leading-none">
                      {spec.width}×{spec.length}
                    </span>
                  </div>
                  <div className="text-center">
                    <Badge
                      variant={
                        spec.packType === "罐装" ? "default" : "outline"
                      }
                      className="text-[10px]"
                    >
                      #{spec.id}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
