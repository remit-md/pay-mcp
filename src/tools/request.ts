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
const PRICE_WARN_THRESHOLD = 5_000_000; // $5.00 — flag prices above this

interface PaymentRequirements {
  settlement: string;
  amount: number;
  to: string;
  facilitator_url?: string;
  network?: string;
  /** Raw accepts[0] from x402 v2 402 response — echoed back in payment payload. */
  accepted?: Record<string, unknown>;
}

export function createRequestTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_request",
      description:
        "Make an HTTP request to a URL. If it returns 402 (Payment Required), " +
        "payment is handled automatically via x402.\n\n" +
        "WHEN TO USE: Calling any paid API endpoint. This is the default tool for " +
        "accessing pay-enabled services. Use pay_discover first if you don't have a URL.\n\n" +
        "SETTLEMENT: 'direct' = one-shot USDC transfer per request. " +
        "'tab' = charges against a pre-funded tab (auto-opened if none exists).\n\n" +
        "PRICE CONTEXT: Typical API calls $0.001-$1.00. Weather/data APIs: $0.01-$0.10. " +
        "LLM inference: $0.01-$5.00. Image generation: $0.02-$2.00. " +
        "Prices significantly above these ranges are flagged as suspicious.\n\n" +
        "SAFETY: Only pays facilitators at pay-skill.com. Never blind-retries — " +
        "if payment fails, the error is returned (double-pay is unrecoverable).",
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
  // Try PAYMENT-REQUIRED header (base64 JSON)
  const prHeader = resp.headers.get("payment-required");
  if (prHeader) {
    try {
      const decoded = JSON.parse(atob(prHeader)) as Record<string, unknown>;
      return parseRequirementsObject(decoded);
    } catch {
      // Fall through
    }
  }

  // Fallback: response body
  const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
  const req = (body.requirements ?? body) as Record<string, unknown>;
  return parseRequirementsObject(req);
}

function parseRequirementsObject(obj: Record<string, unknown>): PaymentRequirements {
  // x402 v2 format: { accepts: [{ payTo, amount, extra: { settlement, facilitator } }] }
  const accepts = obj.accepts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(accepts) && accepts.length > 0) {
    const offer = accepts[0];
    const extra = (offer.extra ?? {}) as Record<string, unknown>;
    return {
      settlement: String(extra.settlement ?? "direct"),
      amount: Number(offer.amount ?? 0),
      to: String(offer.payTo ?? ""),
      facilitator_url: extra.facilitator ? String(extra.facilitator) : undefined,
      network: offer.network ? String(offer.network) : undefined,
      accepted: offer,
    };
  }

  // Legacy v1 format: { settlement, amount, to }
  return {
    settlement: String(obj.settlement ?? "direct"),
    amount: Number(obj.amount ?? 0),
    to: String(obj.to ?? ""),
    facilitator_url: obj.facilitator_url ? String(obj.facilitator_url) : undefined,
    network: obj.network ? String(obj.network) : undefined,
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
    x402Version: 2,
    accepted: req.accepted ?? {
      scheme: "exact",
      network: `eip155:${api.getChainId()}`,
      amount: String(req.amount),
      payTo: req.to,
    },
    payload: {
      signature: combinedSignature(auth),
      authorization: {
        from: auth.from,
        to: auth.to,
        value: String(req.amount),
        validAfter: "0",
        validBefore: "0",
        nonce: auth.nonce,
      },
    },
    extensions: {},
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
  const priceWarning = req.amount > PRICE_WARN_THRESHOLD
    ? ` WARNING: $${usd} per request is above typical API pricing ($0.001-$1.00). Verify this is expected.`
    : "";
  return {
    status: retryResp.status,
    body: responseBody,
    payment: {
      settlement: "direct",
      amount: req.amount,
      amount_usd: `$${usd}`,
      to: req.to,
      context: `Paid $${usd} via direct settlement.${priceWarning}`,
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
      { amount: tabAmount, spender: contracts.tab },
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
    x402Version: 2,
    accepted: req.accepted ?? {
      scheme: "exact",
      network: `eip155:${api.getChainId()}`,
      amount: String(req.amount),
      payTo: req.to,
    },
    payload: {
      authorization: { from: api.getAddress() },
    },
    extensions: {
      pay: {
        settlement: "tab",
        tabId: tab.id,
        chargeId: charge.charge_id,
      },
    },
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
  const priceWarning = req.amount > PRICE_WARN_THRESHOLD
    ? ` WARNING: $${usd} per request is above typical API pricing. Verify this is expected.`
    : "";
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
          `for ${req.to}. Charged $${usd}.${priceWarning}`
        : `Charged $${usd} against tab ${tab.id}.${priceWarning}`,
    },
  };
}
