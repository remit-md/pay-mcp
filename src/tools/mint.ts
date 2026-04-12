/**
 * pay_mint — mint testnet USDC for development and testing.
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { MintArgs } from "./validate.js";

export function createMintTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_mint",
      description:
        "Mint testnet USDC (Base Sepolia only). Free test tokens with no real value.\n\n" +
        "WHEN TO USE: Testing payments on testnet. Amount is in whole dollars " +
        "(e.g. 100 = $100.00 USDC). Will fail on mainnet — use pay_fund for real USDC.",
      inputSchema: zodToMcpSchema(MintArgs),
    },
    handler: async (args) => {
      const { amount } = args as { amount: number };
      const result = await wallet.mint(amount);
      return {
        tx_hash: result.txHash,
        amount_usdc: result.amount,
        wallet: wallet.address,
      };
    },
  };
}
