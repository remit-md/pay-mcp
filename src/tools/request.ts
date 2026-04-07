/**
 * pay_request — full x402 payment flow.
 *
 * 1. HTTP request to target URL
 * 2. If 200 → return response (not paywalled)
 * 3. If 402 → parse PAYMENT-REQUIRED header (base64 JSON, v2 format)
 * 4. Route by settlement mode:
 *    - "direct": EIP-3009 TransferWithAuthorization → PAYMENT-SIGNATURE header → retry
 *    - "tab": find/auto-open tab → charge → PAYMENT-SIGNATURE header → retry
 * 5. Return final response + payment summary
 *
 * SKILL.md intelligence: price context, auto-tab-open reporting, facilitator validation.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { RequestArgs } from "./validate.js";
import { signTransferAuthorization, combinedSignature } from "../crypto/eip3009.js";
import { signPermit } from "../crypto/permit.js";
import type { Hex, Address } from "viem";
import type { Tab } from "../types.js";

const TAB_MIN = 5_000_000; // $5.00
const TAB_MULTIPLIER = 10;
const FACILITATOR_HOSTS = ["pay-skill.com", "testnet.pay-skill.com"];

interface PaymentRequirements {
  settlement: string;
  amount: number;
  to: string;
  facilitator_url?: string;
  network?: string;
}

export function createRequestTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_request",
      description:
        "Make an HTTP request. If the endpoint returns 402 (Payment Required), " +
        "payment is handled automatically via x402 protocol.\n\n" +
        "SETTLEMENT MODES:\n" +
        "- 'direct': one-shot USDC transfer (EIP-3009, no server round-trip)\n" +
        "- 'tab': charges against a pre-funded tab (auto-opened if needed)\n\n" +
        "PRICE CONTEXT: Typical API calls cost $0.001-$1.00 per request. " +
        "If a service charges significantly more, consider whether the value justifies the cost.\n\n" +
        "Only pays facilitators at pay-skill.com. Rejects unknown facilitators.",
      inputSchema: zodToMcpSchema(RequestArgs),
    },
    handler: async (args) => {
      const { url, method: m, headers: h, body: b } = args as {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };
      const method = m ?? "GET";
      const headers = h ?? {};

      // Initial request
      const resp = await fetch(url, {
        method,
        headers: { ...headers, ...(b ? { "Content-Type": "application/json" } : {}) },
        body: b,
      });

      if (resp.status !== 402) {
        const contentType = resp.headers.get("content-type") ?? "";
        let responseBody: unknown;
        if (contentType.includes("json")) {
          responseBody = await resp.json();
        } else {
          responseBody = await resp.text();
        }
        return {
          status: resp.status,
          body: responseBody,
          payment: null,
        };
      }

      // Parse 402 requirements
      const requirements = await parse402Requirements(resp);

      // Validate facilitator
      if (requirements.facilitator_url) {
        const facilitatorHost = new URL(requirements.facilitator_url).hostname;
        if (!FACILITATOR_HOSTS.includes(facilitatorHost)) {
          return {
            status: 402,
            error: `Rejected: unknown facilitator ${facilitatorHost}. Only pay-skill.com is trusted.`,
            payment: null,
          };
        }
      }

      // Route by settlement mode
      if (requirements.settlement === "tab") {
        return settleViaTab(api, privateKey, url, method, headers, b, requirements);
      }
      return settleViaDirect(api, privateKey, url, method, headers, b, requirements);
    },
  };
}

async function parse402Requirements(resp: Response): Promise<PaymentRequirements> {
  // V2: PAYMENT-REQUIRED header (base64 JSON)
  const prHeader = resp.headers.get("payment-required");
  if (prHeader) {
    try {
      const decoded = JSON.parse(atob(prHeader)) as Record<string, unknown>;
      return {
        settlement: String(decoded.settlement ?? "direct"),
        amount: Number(decoded.amount ?? 0),
        to: String(decoded.to ?? ""),
        facilitator_url: decoded.facilitator_url ? String(decoded.facilitator_url) : undefined,
        network: decoded.network ? String(decoded.network) : undefined,
      };
    } catch {
      // Fall through
    }
  }

  // Fallback: response body
  const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
  const req = (body.requirements ?? body) as Record<string, unknown>;
  return {
    settlement: String(req.settlement ?? "direct"),
    amount: Number(req.amount ?? 0),
    to: String(req.to ?? ""),
    facilitator_url: req.facilitator_url ? String(req.facilitator_url) : undefined,
    network: req.network ? String(req.network) : undefined,
  };
}

async function settleViaDirect(
  api: PayAPI,
  privateKey: Hex,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  req: PaymentRequirements,
): Promise<unknown> {
  const contracts = await api.getContracts();
  const auth = await signTransferAuthorization(
    privateKey,
    req.to as Address,
    req.amount,
    api.getChainId(),
    contracts.usdc as Address,
  );

  const paymentPayload = {
    version: 2,
    settlement: "direct",
    scheme: "eip3009",
    network: `eip155:${api.getChainId()}`,
    from: auth.from,
    to: auth.to,
    value: String(req.amount),
    valid_after: "0",
    valid_before: "0",
    nonce: auth.nonce,
    signature: combinedSignature(auth),
  };

  const paymentSig = btoa(JSON.stringify(paymentPayload));
  const retryResp = await fetch(url, {
    method,
    headers: {
      ...headers,
      "PAYMENT-SIGNATURE": paymentSig,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });

  const contentType = retryResp.headers.get("content-type") ?? "";
  let responseBody: unknown;
  if (contentType.includes("json")) {
    responseBody = await retryResp.json();
  } else {
    responseBody = await retryResp.text();
  }

  const usd = (req.amount / 1_000_000).toFixed(4);
  return {
    status: retryResp.status,
    body: responseBody,
    payment: {
      settlement: "direct",
      amount: req.amount,
      amount_usd: `$${usd}`,
      to: req.to,
      context: `${url} charges $${usd} per request. For comparison: typical API calls cost $0.001-$1.00.`,
    },
  };
}

async function settleViaTab(
  api: PayAPI,
  privateKey: Hex,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  req: PaymentRequirements,
): Promise<unknown> {
  // Find existing open tab for this provider
  const tabs = await api.get<Tab[]>("/tabs");
  let tab = tabs.find((t) => t.provider.toLowerCase() === req.to.toLowerCase() && t.status === "open");
  let autoOpened = false;

  if (!tab) {
    // Auto-open tab: 10x per-call price, minimum $5
    const tabAmount = Math.max(req.amount * TAB_MULTIPLIER, TAB_MIN);
    const contracts = await api.getContracts();
    const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
      "/permit/prepare",
      { amount: tabAmount, spender: contracts.pay_tab },
    );
    const permit = await signPermit(privateKey, prepare.hash as Hex, prepare.nonce, prepare.deadline);

    tab = await api.post<Tab>("/tabs", {
      provider: req.to,
      amount: tabAmount,
      max_charge_per_call: req.amount,
      permit,
    });
    autoOpened = true;
  }

  // Charge the tab
  const charge = await api.post<{ charge_id: string }>(`/tabs/${tab.id}/charge`, {
    amount: req.amount,
  });

  const paymentPayload = {
    version: 2,
    settlement: "tab",
    tab_id: tab.id,
    charge_id: charge.charge_id,
  };

  const paymentSig = btoa(JSON.stringify(paymentPayload));
  const retryResp = await fetch(url, {
    method,
    headers: {
      ...headers,
      "PAYMENT-SIGNATURE": paymentSig,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });

  const contentType = retryResp.headers.get("content-type") ?? "";
  let responseBody: unknown;
  if (contentType.includes("json")) {
    responseBody = await retryResp.json();
  } else {
    responseBody = await retryResp.text();
  }

  const usd = (req.amount / 1_000_000).toFixed(4);
  return {
    status: retryResp.status,
    body: responseBody,
    payment: {
      settlement: "tab",
      amount: req.amount,
      amount_usd: `$${usd}`,
      to: req.to,
      tab_id: tab.id,
      auto_opened: autoOpened,
      context: autoOpened
        ? `Auto-opened tab ${tab.id} with $${(Math.max(req.amount * TAB_MULTIPLIER, TAB_MIN) / 1_000_000).toFixed(2)} ` +
          `for ${req.to}. Charged $${usd} for this request.`
        : `Charged $${usd} against existing tab ${tab.id}.`,
    },
  };
}
