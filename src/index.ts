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

async function main(): Promise<void> {
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
