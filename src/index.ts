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
 *         "PAYSKILL_KEY": "0x...",
 *         "PAY_NETWORK": "mainnet"
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Wallet } from "@pay-skill/sdk";
import { createServer } from "./server.js";

function isTestnet(): boolean {
  return process.env.PAY_NETWORK?.toLowerCase() === "testnet";
}

async function check(): Promise<void> {
  const testnet = isTestnet();
  const network = testnet ? "Base Sepolia" : "Base";
  const chainId = testnet ? 84532 : 8453;
  const apiUrl = testnet
    ? "https://testnet.pay-skill.com/api/v1"
    : "https://pay-skill.com/api/v1";

  console.log(`pay-mcp diagnostic check`);
  console.log(`  network: ${network} (chain ${chainId})`);
  console.log(`  api:     ${apiUrl}`);

  let wallet: Wallet;
  try {
    wallet = await Wallet.create({ testnet });
    console.log(`  wallet:  ${wallet.address}`);
  } catch (err) {
    console.log(`  wallet:  FAILED - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return;
  }

  // API connectivity
  try {
    const resp = await fetch(`${apiUrl}/contracts`);
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
    const status = await wallet.status();
    console.log(`  auth:    OK (balance: $${status.balance.total.toFixed(2)})`);
  } catch (err) {
    console.log(`  auth:    FAILED - ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`\nAll checks passed. MCP server is ready.`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--check")) {
    await check();
    return;
  }

  const testnet = isTestnet();
  const wallet = await Wallet.create({ testnet });

  const network = testnet ? "Base Sepolia" : "Base";
  const chainId = testnet ? 84532 : 8453;
  console.error(`pay-mcp: starting on ${network} (chain ${chainId})`);
  console.error(`pay-mcp: wallet ${wallet.address}`);

  const server = createServer(wallet);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(
    "pay-mcp: fatal error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
