#!/usr/bin/env node
/**
 * @pay-skill/mcp — entry point
 *
 * Starts the MCP server on stdio transport. Configure in claude_desktop_config.json:
 *
 *   "mcpServers": {
 *     "pay": {
 *       "command": "npx",
 *       "args": ["@pay-skill/mcp"],
 *       "env": {
 *         "PAYSKILL_SIGNER_KEY": "0x...",
 *         "PAY_NETWORK": "mainnet"
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { resolveKey } from "./signer/index.js";
import { privateKeyToAddress } from "./crypto/address.js";
import { PayAPI } from "./api.js";
import type { Hex } from "viem";

export const NETWORK_CONFIG = {
  mainnet: {
    chainId: 8453,
    apiUrl: "https://pay-skill.com/api/v1",
    name: "Base",
  },
  testnet: {
    chainId: 84532,
    apiUrl: "https://testnet.pay-skill.com/api/v1",
    name: "Base Sepolia",
  },
} as const;

export type NetworkName = keyof typeof NETWORK_CONFIG;

function resolveNetwork(): NetworkName {
  const env = process.env.PAY_NETWORK?.toLowerCase();
  if (env === "testnet") return "testnet";
  return "mainnet";
}

async function check(): Promise<void> {
  const network = resolveNetwork();
  const config = NETWORK_CONFIG[network];
  console.log(`pay-mcp diagnostic check`);
  console.log(`  network: ${config.name} (chain ${config.chainId})`);
  console.log(`  api:     ${config.apiUrl}`);

  // Key resolution
  let address: string;
  try {
    const resolved = await resolveKey();
    address = privateKeyToAddress(resolved.privateKeyHex);
    console.log(`  wallet:  ${address}`);
    console.log(`  key:     ${resolved.source}`);
  } catch (err) {
    console.log(`  wallet:  FAILED - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // API connectivity
  try {
    const resp = await fetch(`${config.apiUrl}/contracts`);
    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>;
      console.log(`  server:  OK (router: ${data.router})`);
    } else {
      console.log(`  server:  FAILED (HTTP ${resp.status})`);
      process.exit(1);
    }
  } catch (err) {
    console.log(`  server:  UNREACHABLE - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Auth check
  try {
    const privateKey = (`0x${(await resolveKey()).privateKeyHex}`) as Hex;
    const api = new PayAPI(privateKey, address, config.apiUrl, config.chainId);
    const status = await api.get<{ balance_usdc: string }>("/status");
    console.log(`  auth:    OK (balance: $${(Number(status.balance_usdc) / 1_000_000).toFixed(2)})`);
  } catch (err) {
    console.log(`  auth:    FAILED - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`\nAll checks passed. MCP server is ready.`);
}

async function main(): Promise<void> {
  // --check diagnostic mode
  if (process.argv.includes("--check")) {
    await check();
    return;
  }

  const network = resolveNetwork();
  const config = NETWORK_CONFIG[network];

  const resolved = await resolveKey();
  const address = privateKeyToAddress(resolved.privateKeyHex);

  console.error(
    `pay-mcp: starting on ${config.name} (chain ${config.chainId}), api: ${config.apiUrl}`,
  );
  console.error(`pay-mcp: wallet ${address} (key source: ${resolved.source})`);

  const privateKey = (`0x${resolved.privateKeyHex}`) as Hex;
  const api = new PayAPI(privateKey, address, config.apiUrl, config.chainId);

  const server = createServer(api, privateKey);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until stdin closes
}

main().catch((err) => {
  console.error(
    "pay-mcp: fatal error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
