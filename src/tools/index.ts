/**
 * Tool registry — builds all tools, dispatches callTool.
 */

import type { PayAPI } from "../api.js";
import type { Hex } from "viem";
import type { ToolInputSchema } from "./schema.js";
import { createStatusTool } from "./status.js";
import { createSendTool } from "./send.js";
import { createTabTools } from "./tabs.js";
import { createRequestTool } from "./request.js";
import { createDiscoverTool } from "./discover.js";

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

/**
 * Build all tools for the server. Returns the tool list and a dispatch map.
 */
export function buildTools(api: PayAPI, privateKey: Hex): Tool[] {
  return [
    createStatusTool(api),
    createSendTool(api, privateKey),
    ...createTabTools(api, privateKey),
    createRequestTool(api, privateKey),
    createDiscoverTool(api),
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
  return tool.handler(args);
}
