import { NextRequest, NextResponse } from "next/server";
import {
  AttributeIds,
  DataType,
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  StatusCodes,
  type ClientSession,
} from "node-opcua";

import {
  buildOpcNodeId,
  getOpcDebugVariable,
  OPC_DEBUG_ALL_VARIABLES,
  OPC_DEBUG_VARIABLES,
  type OpcDebugDataType,
} from "@/lib/opc-debug";
import { readPlcGatewayConfigFormValue } from "@/lib/plc-config-file";

export const runtime = "nodejs";

type DebugNodeOptions = {
  prefix: string;
  suffix: string;
  includeTiming: boolean;
};

type DebugWriteRequest = {
  prefix?: string;
  suffix?: string;
  includeTiming?: boolean;
  writes?: Record<string, unknown>;
  pulse?: {
    commandCode?: unknown;
    targetX?: unknown;
    targetZ?: unknown;
    pickQty?: unknown;
    pickDir?: unknown;
    servoOn?: unknown;
    pulseMs?: unknown;
  };
};

const DEFAULT_NODE_PREFIX = "ns=4;s=变量表|";
const DEFAULT_PULSE_MS = 250;

function createClient() {
  const config = readPlcGatewayConfigFormValue().value;
  return {
    config,
    client: OPCUAClient.create({
      applicationName: "stacker-web-opc-debug",
      securityMode: MessageSecurityMode[config.securityMode as keyof typeof MessageSecurityMode] ?? MessageSecurityMode.None,
      securityPolicy: SecurityPolicy[config.securityPolicy as keyof typeof SecurityPolicy] ?? SecurityPolicy.None,
      requestedSessionTimeout: config.requestedSessionTimeoutMs,
      defaultTransactionTimeout: 8000,
      transportTimeout: 8000,
      connectionStrategy: {
        maxRetry: 0,
        initialDelay: 250,
        maxDelay: 1000,
      },
      endpointMustExist: false,
    }),
  };
}

function normalizeOptions(request: NextRequest | DebugWriteRequest): DebugNodeOptions {
  if (request instanceof NextRequest) {
    return {
      prefix: request.nextUrl.searchParams.get("prefix") ?? DEFAULT_NODE_PREFIX,
      suffix: request.nextUrl.searchParams.get("suffix") ?? "",
      includeTiming: request.nextUrl.searchParams.get("includeTiming") === "true",
    };
  }

  return {
    prefix: typeof request.prefix === "string" ? request.prefix : DEFAULT_NODE_PREFIX,
    suffix: typeof request.suffix === "string" ? request.suffix : "",
    includeTiming: request.includeTiming === true,
  };
}

function dataTypeFor(type: OpcDebugDataType) {
  if (type === "BOOL") return DataType.Boolean;
  if (type === "INT") return DataType.Int16;
  return DataType.Float;
}

function coerceValue(type: OpcDebugDataType, value: unknown) {
  if (type === "BOOL") {
    return value === true || value === "true" || value === "1" || value === 1 || value === "ON";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function statusName(statusCode: unknown) {
  return typeof statusCode === "object" && statusCode !== null && "name" in statusCode
    ? String((statusCode as { name: unknown }).name)
    : String(statusCode);
}

async function openSession() {
  const { client, config } = createClient();
  await client.connect(config.endpointUrl);
  const session = await client.createSession();
  return { client, config, session };
}

async function closeSession(client: OPCUAClient, session?: ClientSession) {
  if (session) {
    await session.close().catch(() => undefined);
  }
  await client.disconnect().catch(() => undefined);
}

async function readDebugVariables(session: ClientSession, options: DebugNodeOptions) {
  const variables = options.includeTiming ? OPC_DEBUG_ALL_VARIABLES : OPC_DEBUG_VARIABLES;
  const nodes = variables.map((variable) => ({
    nodeId: buildOpcNodeId(variable.name, options.prefix, options.suffix),
    attributeId: AttributeIds.Value,
  }));
  const values = await session.read(nodes);

  return variables.map((variable, index) => {
    const dataValue = Array.isArray(values) ? values[index] : values;
    const ok = dataValue.statusCode === StatusCodes.Good;
    return {
      ...variable,
      nodeId: buildOpcNodeId(variable.name, options.prefix, options.suffix),
      ok,
      status: statusName(dataValue.statusCode),
      value: ok ? dataValue.value.value : null,
    };
  });
}

async function writeDebugVariable(
  session: ClientSession,
  options: DebugNodeOptions,
  name: string,
  value: unknown,
) {
  const variable = getOpcDebugVariable(name);
  if (!variable || variable.access === "read") {
    throw new Error(`${name} 不是可写 OPC 调试变量。`);
  }

  const nodeId = buildOpcNodeId(variable.name, options.prefix, options.suffix);
  const currentValue = await session.read({
    nodeId,
    attributeId: AttributeIds.Value,
  });
  const writeDataType = currentValue.statusCode === StatusCodes.Good
    ? currentValue.value.dataType
    : dataTypeFor(variable.dataType);

  const statusCode = await session.write({
    nodeId,
    attributeId: AttributeIds.Value,
    value: {
      value: {
        dataType: writeDataType,
        value: coerceValue(variable.dataType, value),
      },
    },
  });

  if (statusCode !== StatusCodes.Good) {
    throw new Error(`写入 ${name} 失败：${statusName(statusCode)}`);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyPulse(session: ClientSession, options: DebugNodeOptions, request: DebugWriteRequest["pulse"]) {
  if (!request) return;

  const pulseMs = Math.min(Math.max(Number(request.pulseMs) || DEFAULT_PULSE_MS, 50), 2000);
  const orderedWrites: Array<[string, unknown]> = [];

  if (request.targetX !== undefined) orderedWrites.push(["OPC_TargetX", request.targetX]);
  if (request.targetZ !== undefined) orderedWrites.push(["OPC_TargetZ", request.targetZ]);
  if (request.pickQty !== undefined) orderedWrites.push(["OPC_PickQty", request.pickQty]);
  if (request.pickDir !== undefined) orderedWrites.push(["OPC_PickDir", request.pickDir]);
  if (request.servoOn !== undefined) orderedWrites.push(["OPC_ServoOn", request.servoOn]);
  if (request.commandCode !== undefined) orderedWrites.push(["OPC_CmdCode", request.commandCode]);

  for (const [name, value] of orderedWrites) {
    await writeDebugVariable(session, options, name, value);
  }

  await writeDebugVariable(session, options, "OPC_CmdReq", true);
  await sleep(pulseMs);
  await writeDebugVariable(session, options, "OPC_CmdReq", false);
}

export async function GET(request: NextRequest) {
  const options = normalizeOptions(request);
  let endpointUrl = "";
  const { client, config, session } = await openSession();
  endpointUrl = config.endpointUrl;

  try {
    const variables = await readDebugVariables(session, options);
    return NextResponse.json({
      endpointUrl: config.endpointUrl,
      prefix: options.prefix,
      suffix: options.suffix,
      variables,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      code: "opc_debug_read_failed",
      message: error instanceof Error ? error.message : "OPC 调试变量读取失败",
      endpointUrl,
    }, { status: 502 });
  } finally {
    await closeSession(client, session);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as DebugWriteRequest;
  const options = normalizeOptions(body);
  let endpointUrl = "";
  const { client, config, session } = await openSession();
  endpointUrl = config.endpointUrl;

  try {
    for (const [name, value] of Object.entries(body.writes ?? {})) {
      await writeDebugVariable(session, options, name, value);
    }
    await applyPulse(session, options, body.pulse);

    const variables = await readDebugVariables(session, options);
    return NextResponse.json({
      endpointUrl: config.endpointUrl,
      prefix: options.prefix,
      suffix: options.suffix,
      variables,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      code: "opc_debug_write_failed",
      message: error instanceof Error ? error.message : "OPC 调试变量写入失败",
      endpointUrl,
    }, { status: 502 });
  } finally {
    await closeSession(client, session);
  }
}
