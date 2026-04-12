/**
 * pay_fund — generate a fund link for depositing USDC.
 * pay_withdraw — generate a withdraw link for pulling USDC out.
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { FundArgs, WithdrawArgs } from "./validate.js";

export function createFundTool(wallet: Wallet): Tool {
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
      const url = await wallet.createFundLink({
        message: args.message,
        agentName: args.name,
      });
      return {
        url,
        wallet: wallet.address,
        tip: "Share this URL to fund the wallet. Link expires in 1 hour. " +
          "Poll pay_status to detect when funds arrive.",
      };
    },
  };
}

export function createWithdrawTool(wallet: Wallet): Tool {
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
      const url = await wallet.createWithdrawLink();
      return { url, wallet: wallet.address };
    },
  };
}
