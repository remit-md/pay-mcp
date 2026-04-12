/**
 * MCP Resources — read-only data endpoints for the Pay wallet.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Wallet } from "@pay-skill/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCES_DIR = join(__dirname, "..", "..", "skills", "pay", "references");

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

const RESOURCES: ResourceDefinition[] = [
  {
    uri: "pay://wallet/status",
    name: "Wallet Status",
    description: "USDC balance, open tab count, locked and available funds",
    mimeType: "application/json",
  },
  {
    uri: "pay://wallet/tabs",
    name: "Open Tabs",
    description: "All open tabs with pending charge info",
    mimeType: "application/json",
  },
  {
    uri: "pay://wallet/address",
    name: "Wallet Address",
    description: "The wallet's Ethereum address",
    mimeType: "application/json",
  },
  {
    uri: "pay://network",
    name: "Network Config",
    description: "Current network configuration (chain ID, API URL)",
    mimeType: "application/json",
  },
  {
    uri: "pay://reference/rules",
    name: "Rules & Limits",
    description: "Protocol-enforced values: fee structure, minimums, rate limits, gas costs, micro-USDC conversion",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/errors",
    name: "Error Recovery",
    description: "Error codes and recovery procedures: INSUFFICIENT_BALANCE, TAB_DEPLETED, RATE_LIMITED, nonce replay",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/tabs",
    name: "Tab Guide",
    description: "Tab lifecycle: sizing heuristics, activation fees, max-charge, closing, idle cleanup, multiple tabs",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/x402",
    name: "x402 Protocol",
    description: "x402 payment protocol: settlement modes, auto-tab-open, non-Pay facilitators, pay-gate, wire format",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/funding",
    name: "Funding Guide",
    description: "Wallet setup, funding flow, polling for deposits, direct USDC transfer, balance checks",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/a2a",
    name: "A2A Payments",
    description: "Agent-to-Agent protocol integration: direct payments, tabs, AP2 mandate validation, relay patterns",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/discovery",
    name: "Service Discovery",
    description: "Heartbeat-based registry, API search, provider configuration, manifest format, fallback behavior",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/examples",
    name: "Worked Examples",
    description: "7 worked examples: weather API, direct payment, translation, x402 check, image gen, low balance, A2A",
    mimeType: "text/markdown",
  },
  {
    uri: "pay://reference/adoption",
    name: "Provider Adoption",
    description: "Suggesting providers adopt pay-gate: cost/benefit, when to reach out, autonomous outreach guidelines",
    mimeType: "text/markdown",
  },
];

const RESOURCE_TEMPLATES: ResourceTemplateDefinition[] = [
  {
    uriTemplate: "pay://tab/{tab_id}",
    name: "Tab Detail",
    description: "Detailed information about a specific tab by ID",
    mimeType: "application/json",
  },
];

export function listResources(): ResourceDefinition[] {
  return RESOURCES;
}

export function listResourceTemplates(): ResourceTemplateDefinition[] {
  return RESOURCE_TEMPLATES;
}

const REFERENCE_NAMES = new Set([
  "rules", "errors", "tabs", "x402", "funding", "a2a", "discovery", "examples", "adoption",
]);

type ParsedUri =
  | { type: "status" }
  | { type: "tabs" }
  | { type: "address" }
  | { type: "network" }
  | { type: "tab"; id: string }
  | { type: "reference"; name: string };

function parseUri(uri: string): ParsedUri | null {
  if (uri === "pay://wallet/status") return { type: "status" };
  if (uri === "pay://wallet/tabs") return { type: "tabs" };
  if (uri === "pay://wallet/address") return { type: "address" };
  if (uri === "pay://network") return { type: "network" };

  const refMatch = /^pay:\/\/reference\/([a-z0-9]+)$/.exec(uri);
  if (refMatch && REFERENCE_NAMES.has(refMatch[1] as string))
    return { type: "reference", name: refMatch[1] as string };

  const tabMatch = /^pay:\/\/tab\/([^/]+)$/.exec(uri);
  if (tabMatch) return { type: "tab", id: tabMatch[1] as string };

  return null;
}

export async function readResource(
  uri: string,
  wallet: Wallet,
): Promise<{ mimeType: string; text: string }> {
  const parsed = parseUri(uri);
  if (!parsed) throw new Error(`Unknown resource URI: ${uri}`);

  let data: unknown;

  switch (parsed.type) {
    case "status": {
      data = await wallet.status();
      break;
    }
    case "tabs": {
      data = await wallet.listTabs();
      break;
    }
    case "address": {
      data = { address: wallet.address };
      break;
    }
    case "network": {
      data = { wallet: wallet.address };
      break;
    }
    case "tab": {
      data = await wallet.getTab(parsed.id);
      break;
    }
    case "reference": {
      const filePath = join(REFERENCES_DIR, `${parsed.name}.md`);
      const text = await readFile(filePath, "utf-8");
      return { mimeType: "text/markdown", text };
    }
  }

  return { mimeType: "application/json", text: JSON.stringify(data) };
}
