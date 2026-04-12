/**
 * pay_status — wallet balance, open tabs, locked/available USDC.
 */

import type { Wallet, Status } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { StatusArgs } from "./validate.js";

export function createStatusTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_status",
      description:
        "Check wallet balance and status. Shows USDC balance, open tab count, " +
        "locked vs available funds.\n\n" +
        "WHEN TO USE:\n" +
        "- Before any payment to verify sufficient funds\n" +
        "- After funding to confirm deposit arrived\n" +
        "- When deciding whether to close idle tabs (locked funds reduce available balance)\n\n" +
        "RESPONSE INCLUDES: balance, locked amount, available amount, open tab count, " +
        "and a suggestion field with actionable advice (low balance, idle tabs, etc.).",
      inputSchema: zodToMcpSchema(StatusArgs),
    },
    handler: async () => {
      const status = await wallet.status();
      return {
        wallet: status.address,
        balance_usdc: (status.balance.total * 1_000_000).toString(),
        available_usdc: (status.balance.available * 1_000_000).toString(),
        locked_usdc: (status.balance.locked * 1_000_000).toString(),
        open_tabs: status.openTabs,
        balance: status.balance,
        suggestion: buildSuggestion(status),
      };
    },
  };
}

function buildSuggestion(s: Status): string | null {
  if (s.balance.total === 0) {
    return "Wallet is empty. Use pay_fund to generate a funding link, then deposit USDC.";
  }
  if (s.balance.locked > 0 && s.balance.available < 1) {
    return `Low available balance ($${s.balance.available.toFixed(2)}). ` +
      `$${s.balance.locked.toFixed(2)} is locked in ${s.openTabs} open tab(s). ` +
      "Use pay_tab_list to check for idle tabs you can close to free funds.";
  }
  if (s.balance.available < 1) {
    return "Balance below $1.00 — insufficient for direct payments ($1 minimum). " +
      "Use pay_fund to generate a funding link.";
  }
  if (s.openTabs > 3) {
    return `${s.openTabs} tabs open. Use pay_tab_list to review — idle tabs lock funds unnecessarily.`;
  }
  return null;
}
