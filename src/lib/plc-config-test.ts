import {
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua-secure-channel";
import { OPCUAClient } from "node-opcua-client";

import type { PlcGatewayConfigFormValue } from "@/lib/plc-config";

const DEFAULT_CONNECTION_TEST_TIMEOUT_MS = 10000;

export type PlcConnectionTestResult = {
  ok: boolean;
  endpointUrl: string;
  message: string;
  checkedAt: string;
};

function resolveConnectionTestTimeoutMs(value: PlcGatewayConfigFormValue) {
  const configuredTimeout = Math.max(
    value.ackTimeoutMs,
    value.reconnectIntervalMs,
    value.pollIntervalMs,
  );

  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
    return DEFAULT_CONNECTION_TEST_TIMEOUT_MS;
  }

  return Math.min(Math.max(configuredTimeout * 2, 3000), DEFAULT_CONNECTION_TEST_TIMEOUT_MS);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`连接测试超时（${Math.round(timeoutMs / 1000)} 秒）。请检查 endpoint、网络或 PLC OPC UA 服务状态。`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function testPlcConnectionConfig(value: PlcGatewayConfigFormValue): Promise<PlcConnectionTestResult> {
  const testTimeoutMs = resolveConnectionTestTimeoutMs(value);
  const client = OPCUAClient.create({
    applicationName: "stacker-web-config-tester",
    securityMode: MessageSecurityMode[value.securityMode as keyof typeof MessageSecurityMode] ?? MessageSecurityMode.None,
    securityPolicy: SecurityPolicy[value.securityPolicy as keyof typeof SecurityPolicy] ?? SecurityPolicy.None,
    requestedSessionTimeout: value.requestedSessionTimeoutMs,
    defaultTransactionTimeout: testTimeoutMs,
    transportTimeout: testTimeoutMs,
    connectionStrategy: {
      maxRetry: 0,
      initialDelay: 250,
      maxDelay: 1000,
    },
    endpointMustExist: false,
  });

  try {
    await withTimeout((async () => {
      await client.connect(value.endpointUrl);
      const session = await client.createSession();
      await session.close();
    })(), testTimeoutMs);

    return {
      ok: true,
      endpointUrl: value.endpointUrl,
      message: "OPC UA endpoint 可连通，Session 已成功建立。",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      endpointUrl: value.endpointUrl,
      message: error instanceof Error ? error.message : "连接测试失败",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    void client.disconnect().catch(() => {
      // ignore disconnect cleanup errors
    });
  }
}
