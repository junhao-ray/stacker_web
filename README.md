This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PLC / OPC UA Gateway

This repo now includes an internal OPC UA gateway service for PLC task-level control:

1. Copy `services/opc-gateway/config/plc-config.template.json` to `services/opc-gateway/config/plc-config.json`
2. Fill the real PLC `NodeId` mappings and command codes
3. Set shared env vars:

```bash
export PLC_GATEWAY_SHARED_KEY=replace-me
export PLC_GATEWAY_BASE_URL=http://127.0.0.1:4010
```

4. Start the gateway:

```bash
npm run plc:gateway
```

If you want to test the browser/API flow before现场 OPC联调, you can run the fake transport:

```bash
PLC_GATEWAY_TRANSPORT=fake npm run plc:gateway
```

### OPC UA Simulator

For local end-to-end OPC UA testing without a physical PLC, start the simulator first:

```bash
npm run plc:simulator
```

Then start the gateway with the simulator NodeId mapping:

```bash
npm run plc:gateway:simulator
```

The simulator exposes an OPC UA Server at:

```text
opc.tcp://127.0.0.1:4840/UA/StackerSimulator
```

The gateway HTTP API remains:

```text
http://127.0.0.1:4010
```

Use the app's PLC mode or call `/api/plc/status` and `/api/plc/commands` to test the full Web -> gateway -> OPC UA simulator path.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
