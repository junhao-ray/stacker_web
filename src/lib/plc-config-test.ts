import {
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua-secure-channel";
import { OPCUAClient } from "node-opcua-client";

import type { PlcGatewayConfigFormValue } from "@/lib/plc-config";

export type PlcConnectionTestResult = {
  ok: boolean;
  endpointUrl: string;
  message: string;
  checkedAt: string;
};

export async function testPlcConnectionConfig(value: PlcGatewayConfigFormValue): Promise<PlcConnectionTestResult> {
  const client = OPCUAClient.create({
    applicationName: "stacker-web-config-tester",
    securityMode: MessageSecurityMode[value.securityMode as keyof typeof MessageSecurityMode] ?? MessageSecurityMode.None,
    securityPolicy: SecurityPolicy[value.securityPolicy as keyof typeof SecurityPolicy] ?? SecurityPolicy.None,
    requestedSessionTimeout: value.requestedSessionTimeoutMs,
    endpointMustExist: false,
  });

  try {
    await client.connect(value.endpointUrl);
    const session = await client.createSession();
    await session.close();
    await client.disconnect();

    return {
      ok: true,
      endpointUrl: value.endpointUrl,
      message: "OPC UA endpoint 可连通，Session 已成功建立。",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    try {
      await client.disconnect();
    } catch {
      // ignore disconnect cleanup errors
    }

    return {
      ok: false,
      endpointUrl: value.endpointUrl,
      message: error instanceof Error ? error.message : "连接测试失败",
      checkedAt: new Date().toISOString(),
    };
  }
}
