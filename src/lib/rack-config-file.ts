import fs from "node:fs";
import path from "node:path";

import {
  assertValidRackConfig,
  cloneRackConfig,
  createDefaultRackConfig,
  normalizeRackConfig,
} from "@/lib/rack-config";
import type { TwinRackConfig } from "@/lib/types";

function resolveGatewayRoot() {
  return path.resolve(process.cwd(), "services/opc-gateway");
}

export function resolveRackConfigPath() {
  return process.env.RACK_CONFIG_PATH
    ? path.resolve(process.env.RACK_CONFIG_PATH)
    : path.join(resolveGatewayRoot(), "config", "rack-config.json");
}

function readConfigFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

export function readRackConfigFormValue() {
  const configPath = resolveRackConfigPath();
  const raw = readConfigFile(configPath);
  const value = normalizeRackConfig(raw ?? createDefaultRackConfig());

  return {
    path: configPath,
    exists: fs.existsSync(configPath),
    value: cloneRackConfig(value),
  };
}

export function writeRackConfigFormValue(value: TwinRackConfig) {
  const normalized = normalizeRackConfig(value);
  assertValidRackConfig(normalized);

  const filePath = resolveRackConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return {
    path: filePath,
    exists: true,
    value: cloneRackConfig(normalized),
  };
}
