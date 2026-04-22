import { loadGatewayConfig, isGatewayConfigured } from "./config";
import { FakePlcTransport } from "./fake-transport";
import { PlcGateway } from "./gateway";
import { OpcUaPlcTransport } from "./opcua-transport";
import { createGatewayServer } from "./server";

async function main() {
  const config = loadGatewayConfig();
  const configured = isGatewayConfigured(config);
  const transportMode = process.env.PLC_GATEWAY_TRANSPORT ?? "opcua";
  const port = Number(process.env.PLC_GATEWAY_PORT ?? 4010);

  const transport = transportMode === "fake"
    ? new FakePlcTransport()
    : new OpcUaPlcTransport(config, configured);

  const gateway = new PlcGateway(config, transport);
  await gateway.start();

  const server = createGatewayServer(gateway);
  server.listen(port, () => {
    console.log(`[opc-gateway] listening on :${port} (${transportMode}, configured=${configured})`);
  });

  const shutdown = async () => {
    server.close();
    await gateway.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error("[opc-gateway] failed to start", error);
  process.exit(1);
});
