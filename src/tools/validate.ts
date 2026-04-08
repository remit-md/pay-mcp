/**
 * Zod schemas for all tool inputs.
 */

import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address");
const positiveAmount = z.number().positive("Amount must be positive");

export const EmptyArgs = z.object({});

// ── Status ─────────────────────────────────────────────────────────

export const StatusArgs = z.object({
  wallet: address.optional().describe("Wallet address to check (defaults to your own)"),
});

// ── Direct Payment ─────────────────────────────────────────────────

export const SendArgs = z.object({
  to: address.describe("Recipient wallet address"),
  amount: positiveAmount.describe("Amount in micro-USDC (6 decimals). $1.00 = 1000000. Minimum $1.00"),
  memo: z.string().optional().describe("Optional payment memo"),
});

// ── Tabs ───────────────────────────────────────────────────────────

export const TabOpenArgs = z.object({
  provider: address.describe("Provider wallet address"),
  amount: positiveAmount.describe("Amount to lock in micro-USDC. Minimum $5.00 (5000000)"),
  max_charge: positiveAmount.describe("Maximum amount the provider can charge per call, in micro-USDC"),
});

export const TabCloseArgs = z.object({
  tab_id: z.string().describe("Tab ID to close"),
});

export const TabChargeArgs = z.object({
  tab_id: z.string().describe("Tab ID to charge"),
  amount: positiveAmount.describe("Amount to charge in micro-USDC"),
});

export const TabTopupArgs = z.object({
  tab_id: z.string().describe("Tab ID to top up"),
  amount: positiveAmount.describe("Amount to add in micro-USDC"),
});

export const TabListArgs = z.object({});

// ── x402 Request ───────────────────────────────────────────────────

export const RequestArgs = z.object({
  url: z.string().url().describe("URL to request. If it returns 402, payment is handled automatically"),
  method: z.string().optional().describe("HTTP method (default: GET)"),
  headers: z.record(z.string(), z.string()).optional().describe("Additional request headers"),
  body: z.string().optional().describe("Request body (for POST/PUT)"),
});

// ── Discovery ──────────────────────────────────────────────────────

export const DiscoverArgs = z.object({
  query: z.string().optional().describe("Search keywords"),
  sort: z.enum(["volume", "newest", "name"]).optional().describe("Sort order (default: volume)"),
  category: z.string().optional().describe("Filter by category"),
  settlement: z.enum(["direct", "tab"]).optional().describe("Filter by settlement mode"),
});

// ── Fund / Withdraw ───────────────────────────────────────────────

export const FundArgs = z.object({});

export const WithdrawArgs = z.object({});

// ── Webhooks ──────────────────────────────────────────────────────

export const WebhookRegisterArgs = z.object({
  url: z.string().url().describe("HTTPS URL to receive webhook events"),
  events: z.array(z.string()).optional().describe("Event types to subscribe to (default: all)"),
  secret: z.string().optional().describe("HMAC secret for signature verification (auto-generated if omitted)"),
});

export const WebhookListArgs = z.object({});

export const WebhookDeleteArgs = z.object({
  id: z.string().describe("Webhook registration ID to delete"),
});

// ── Mint ──────────────────────────────────────────────────────────

export const MintArgs = z.object({
  amount: z.number().positive("Amount must be positive").describe("Amount in whole dollars (e.g. 100 = $100.00 USDC). Testnet only."),
});
