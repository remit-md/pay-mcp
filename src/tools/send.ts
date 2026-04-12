/**
 * pay_send — direct USDC payment.
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { SendArgs } from "./validate.js";

export function createSendTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_send",
      description:
        "Send a one-shot USDC payment to an address. Use this for single transfers, " +
        "A2A task payments, or any one-time payment above $1.00.\n\n" +
        "WHEN TO USE: Sending money to a known address. For paid APIs, use pay_request instead " +
        "(it handles 402 detection and payment automatically).\n\n" +
        "Amount is in micro-USDC (6 decimals): $1.00 = 1000000, $10.00 = 10000000.\n" +
        "Minimum: $1.00. Fee: 1% (paid by recipient, deducted from payout).\n\n" +
        "CONFIRMATION THRESHOLDS:\n" +
        "- Under $10: proceed automatically\n" +
        "- $10-$100: explain the payment in your plan before executing\n" +
        "- Over $100: ask the user for explicit confirmation before calling this tool",
      inputSchema: zodToMcpSchema(SendArgs),
    },
    handler: async (args) => {
      const { to, amount, memo } = args as { to: string; amount: number; memo?: string };
      const result = await wallet.send(to, { micro: amount }, memo);

      const usdAmount = result.amount.toFixed(2);
      const usdFee = result.fee.toFixed(2);
      const recipientGets = (result.amount - result.fee).toFixed(2);
      return {
        tx_hash: result.txHash,
        status: result.status,
        amount: result.amount,
        fee: result.fee,
        summary: `Sent $${usdAmount} to ${to}. Tx: ${result.txHash}`,
        fee_breakdown: {
          sent: `$${usdAmount}`,
          fee: `$${usdFee} (1%, paid by recipient)`,
          recipient_receives: `$${recipientGets}`,
        },
      };
    },
  };
}
