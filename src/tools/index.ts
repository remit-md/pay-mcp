/**
 * Tool registry — builds all tools, dispatches callTool.
 */

import type { Wallet, PayError } from "@pay-skill/sdk";
import type { ToolInputSchema } from "./schema.js";
import { createStatusTool } from "./status.js";
import { createSendTool } from "./send.js";
import { createTabTools } from "./tabs.js";
import { createRequestTool } from "./request.js";
import { createDiscoverTool } from "./discover.js";
import { createFundTool, createWithdrawTool } from "./fund.js";
import { createWebhookTools } from "./webhooks.js";
import { createMintTool } from "./mint.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export function buildTools(wallet: Wallet): Tool[] {
  return [
    createStatusTool(wallet),
    createSendTool(wallet),
    ...createTabTools(wallet),
    createRequestTool(wallet),
    createDiscoverTool(wallet),
    createFundTool(wallet),
    createWithdrawTool(wallet),
    ...createWebhookTools(wallet),
    createMintTool(wallet),
  ];
}

export function buildToolRegistry(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.definition.name, t]));
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  registry: Map<string, Tool>,
): Promise<unknown> {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  try {
    return await tool.handler(args);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const payErr = err as { code: string; message: string };
      const recovery = ERROR_RECOVERY[payErr.code];
      if (recovery) throw new Error(`${payErr.message}\n\nRecovery: ${recovery}`);
    }
    throw err;
  }
}

const ERROR_RECOVERY: Record<string, string> = {
  insufficient_funds: "Use pay_status to check balance, then pay_fund to add funds.",
  validation_error: "Check parameter values (address format, amounts, tab IDs).",
  network_error: "Server may be down. Try again in a few seconds.",
  server_error: "Server returned an error. Check the message for details.",
};
