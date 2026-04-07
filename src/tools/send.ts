/**
 * pay_send — direct USDC payment with EIP-2612 permit.
 *
 * SKILL.md confirmation thresholds:
 * - < $10: proceed automatically
 * - $10-$100: include in plan, explain before executing
 * - > $100: require explicit confirmation
 *
 * These thresholds are communicated in the tool description and response,
 * but enforcement is up to the MCP client (Claude will respect them).
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { SendArgs } from "./validate.js";
import { signPermit } from "../crypto/permit.js";
import type { Hex } from "viem";
import type { DirectPaymentResult } from "../types.js";

export function createSendTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_send",
      description:
        "Send a direct USDC payment. Minimum $1.00 (1000000 micro-USDC). " +
        "Provider pays 1% processing fee. Amount is in micro-USDC (6 decimals): " +
        "$1.00 = 1000000, $10.00 = 10000000.\n\n" +
        "CONFIRMATION THRESHOLDS:\n" +
        "- Under $10: proceed automatically\n" +
        "- $10-$100: explain the payment in your plan before executing\n" +
        "- Over $100: ask the user for explicit confirmation before calling this tool",
      inputSchema: zodToMcpSchema(SendArgs),
    },
    handler: async (args) => {
      const { to, amount, memo } = args as { to: string; amount: number; memo?: string };

      // Prepare and sign permit
      const contracts = await api.getContracts();
      const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
        "/permit/prepare",
        { amount, spender: contracts.pay_direct },
      );
      const permit = await signPermit(
        privateKey,
        prepare.hash as Hex,
        prepare.nonce,
        prepare.deadline,
      );

      const result = await api.post<DirectPaymentResult>("/direct", {
        to,
        amount,
        memo: memo ?? "",
        permit,
      });

      const usdAmount = (amount / 1_000_000).toFixed(2);
      return {
        ...result,
        summary: `Sent $${usdAmount} USDC to ${to}. Transaction: ${result.tx_hash}`,
      };
    },
  };
}
