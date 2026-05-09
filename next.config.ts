import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "node-opcua",
    "node-opcua-client",
    "node-opcua-secure-channel",
    "node-opcua-certificate-manager",
    "node-opcua-pki",
    "@ster5/global-mutex",
    "proper-lockfile",
  ],
};

export default nextConfig;
