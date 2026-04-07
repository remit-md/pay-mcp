import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { PayAPI } from "./api.js";
import type { Hex } from "viem";
import { buildTools, buildToolRegistry, callTool } from "./tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const SERVER_INFO = { name: "@pay-skill/mcp", version: pkg.version };

/**
 * Create and configure the MCP server with all tools, resources, and prompts.
 * The PayAPI instance is captured in closure — the private key never leaves this process.
 */
export function createServer(api: PayAPI, privateKey: Hex): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  });

  const tools = buildTools(api, privateKey);
  const registry = buildToolRegistry(tools);

  // ─── Tools ──────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await callTool(name, args as Record<string, unknown>, registry);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  // ─── Resources ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  });

  // ─── Prompts ────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  });

  return server;
}
