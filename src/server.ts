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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const SERVER_INFO = { name: "@pay-skill/mcp", version: pkg.version };

/**
 * Create and configure the MCP server with all tools, resources, and prompts.
 * The PayAPI instance is captured in closure — the private key never leaves this process.
 */
export function createServer(_api: PayAPI): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  });

  // ─── Tools ──────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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
