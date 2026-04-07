/**
 * pay_status — wallet balance, open tabs, locked/available USDC.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { StatusArgs } from "./validate.js";
import type { StatusResponse } from "../types.js";

export function createStatusTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_status",
      description:
        "Check wallet balance and status. Shows USDC balance, open tab count, " +
        "locked vs available funds. Use this before making payments to verify " +
        "sufficient funds. If open_tabs > 0 and you haven't used them recently, " +
        "consider closing idle tabs to free locked funds.",
      inputSchema: zodToMcpSchema(StatusArgs),
    },
    handler: async (args) => {
      const wallet = (args as { wallet?: string }).wallet;
      const path = wallet ? `/status/${wallet}` : "/status";
      const status = await api.get<StatusResponse>(path);
      return {
        ...status,
        suggestion: buildSuggestion(status),
      };
    },
  };
}

function buildSuggestion(s: StatusResponse): string | null {
  const available = Number(s.available_usdc);
  const locked = Number(s.locked_usdc);
  if (locked > 0 && available < 1_000_000) {
    return `Low available balance ($${(available / 1_000_000).toFixed(2)}). ` +
      `$${(locked / 1_000_000).toFixed(2)} is locked in ${s.open_tabs} open tab(s). ` +
      "Consider closing idle tabs to free funds.";
  }
  if (available < 1_000_000) {
    return "Balance below $1.00. Fund your wallet before making payments.";
  }
  return null;
}
