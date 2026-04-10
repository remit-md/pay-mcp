/**
 * pay_fund — generate a fund link for depositing USDC into the wallet.
 * pay_withdraw — generate a withdraw link for pulling USDC out.
 *
 * Both create short-lived bearer-token URLs via the server.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { FundArgs, WithdrawArgs } from "./validate.js";
import type { FundLinkResponse, WithdrawLinkResponse } from "../types.js";

export function createFundTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_fund",
      description:
        "Generate a funding link to deposit USDC into your wallet.\n\n" +
        "WHEN TO USE: Balance too low for payments. pay_status shows insufficient funds.\n\n" +
        "FLOW: Generate link -> share with operator (or open in browser) -> " +
        "operator deposits via Coinbase Onramp or direct USDC transfer -> " +
        "poll pay_status every 30s to confirm arrival.\n\n" +
        "Link expires in 1 hour. Single-use. Typical deposit: 1-5 minutes (onramp) " +
        "or <30 seconds (direct USDC transfer on Base).",
      inputSchema: zodToMcpSchema(FundArgs),
    },
    handler: async (args: { message?: string; name?: string }) => {
      const body: Record<string, unknown> = {};
      if (args.message) {
        body.messages = [{ role: "agent", text: args.message }];
      }
      if (args.name) {
        body.agent_name = args.name;
      }
      const result = await api.post<FundLinkResponse>("/links/fund", body);
      return {
        url: result.url,
        expires_at: result.expires_at,
        wallet: api.getAddress(),
        tip: "Share this URL to fund the wallet. Link expires in 1 hour. " +
          "Poll pay_status to detect when funds arrive.",
      };
    },
  };
}

export function createWithdrawTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_withdraw",
      description:
        "Generate a withdrawal link to pull USDC out of your wallet.\n\n" +
        "WHEN TO USE: Moving funds out of the agent wallet. Share the link with " +
        "a human operator to complete the withdrawal in a browser.\n\n" +
        "Link expires in 1 hour. Single-use.",
      inputSchema: zodToMcpSchema(WithdrawArgs),
    },
    handler: async () => {
      const result = await api.post<WithdrawLinkResponse>("/links/withdraw");
      return {
        url: result.url,
        expires_at: result.expires_at,
        wallet: api.getAddress(),
      };
    },
  };
}
