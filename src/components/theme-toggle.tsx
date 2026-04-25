"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThemePreference } from "@/lib/theme";

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === "light") {
    return <SunMedium className="size-4 text-muted-foreground" />;
  }

  if (theme === "dark") {
    return <MoonStar className="size-4 text-muted-foreground" />;
  }

  return <LaptopMinimal className="size-4 text-muted-foreground" />;
}

export function ThemeToggle() {
  const { mounted, setTheme, theme } = useTheme();

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-[124px] justify-start gap-2 bg-background/80 text-muted-foreground backdrop-blur-sm"
        disabled
      >
        <LaptopMinimal className="size-4" />
        主题
      </Button>
    );
  }

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
      <SelectTrigger
        size="sm"
        className="w-[124px] gap-2 bg-background/80 backdrop-blur-sm"
      >
        <ThemeIcon theme={theme} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel>主题</SelectLabel>
          <SelectItem value="system">跟随系统</SelectItem>
          <SelectItem value="light">浅色</SelectItem>
          <SelectItem value="dark">深色</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
