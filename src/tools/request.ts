/**
 * pay_request — full x402 payment flow via SDK Wallet.
 *
 * The Wallet.request() method handles the entire x402 protocol:
 * detect 402, parse requirements, sign payment, retry with proof.
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { RequestArgs } from "./validate.js";

export function createRequestTool(wallet: Wallet): Tool {
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

      const resp = await wallet.request(url, {
        method: m,
        body: b ? JSON.parse(b) : undefined,
        headers: h,
      });

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
      };
    },
  };
}
