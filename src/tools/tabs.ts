/**
 * Tab tools — open, close, charge, topup, list.
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { TabOpenArgs, TabCloseArgs, TabChargeArgs, TabTopupArgs, TabListArgs } from "./validate.js";

export function createTabTools(wallet: Wallet): Tool[] {
  return [
    createTabOpenTool(wallet),
    createTabCloseTool(wallet),
    createTabChargeTool(wallet),
    createTabTopupTool(wallet),
    createTabListTool(wallet),
  ];
}

function createTabOpenTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_tab_open",
      description:
        "Open a pre-funded metered tab with a provider. Use tabs for repeated API calls " +
        "or ongoing service access — more gas-efficient than per-call direct payments.\n\n" +
        "WHEN TO USE: Multiple calls to the same provider, sub-$1 per-call pricing, " +
        "or when pay_request auto-opens one (tab settlement mode). For one-time payments, " +
        "use pay_send instead.\n\n" +
        "SIZING: $50 recommended for cost efficiency (activation fee is 1% = $0.50). " +
        "Minimum $5.00 (activation fee = $0.10). Unused balance refunded on close.\n\n" +
        "max_charge: maximum the provider can charge per single call (contract-enforced). " +
        "Tabs auto-close after 30 days of no charges.",
      inputSchema: zodToMcpSchema(TabOpenArgs),
    },
    handler: async (args) => {
      const { provider, amount, max_charge } = args as {
        provider: string; amount: number; max_charge: number;
      };
      const tab = await wallet.openTab(provider, { micro: amount }, { micro: max_charge });
      return {
        ...tab,
        summary: `Opened tab ${tab.id} with $${tab.amount.toFixed(2)} USDC. ` +
          `Provider can charge up to $${tab.maxChargePerCall.toFixed(2)} per call.`,
      };
    },
  };
}

function createTabCloseTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_tab_close",
      description:
        "Close a tab and settle funds. Either party can close unilaterally.\n\n" +
        "DISTRIBUTION: Provider receives 99% of total charged. Fee wallet gets 1%. " +
        "Agent gets all remaining (unspent) balance back. Pending charges are flushed first.",
      inputSchema: zodToMcpSchema(TabCloseArgs),
    },
    handler: async (args) => {
      const { tab_id } = args as { tab_id: string };
      const tab = await wallet.closeTab(tab_id);
      const providerGets = (tab.totalCharged * 0.99).toFixed(2);
      const feeAmount = (tab.totalCharged * 0.01).toFixed(2);
      return {
        ...tab,
        summary: `Closed tab ${tab_id}.`,
        distribution: {
          total_charged: `$${tab.totalCharged.toFixed(2)}`,
          provider_receives: `$${providerGets} (99%)`,
          fee: `$${feeAmount} (1%)`,
          charges: tab.chargeCount,
        },
      };
    },
  };
}

function createTabChargeTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_tab_charge",
      description:
        "Charge against an open tab. Only the provider can charge. " +
        "Amount must not exceed max_charge_per_call set at tab open.",
      inputSchema: zodToMcpSchema(TabChargeArgs),
    },
    handler: async (args) => {
      const { tab_id, amount } = args as { tab_id: string; amount: number };
      return wallet.chargeTab(tab_id, { micro: amount });
    },
  };
}

function createTabTopupTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_tab_topup",
      description:
        "Add more USDC to an open tab. Only the agent (tab opener) can top up.\n\n" +
        "WHEN TO TOP UP: When effective_balance drops below ~20% of original amount " +
        "or below 10x the per-call charge. Top-up avoids closing and re-opening " +
        "(which would cost another activation fee).",
      inputSchema: zodToMcpSchema(TabTopupArgs),
    },
    handler: async (args) => {
      const { tab_id, amount } = args as { tab_id: string; amount: number };
      const tab = await wallet.topUpTab(tab_id, { micro: amount });
      return {
        ...tab,
        summary: `Topped up tab ${tab_id} with $${(amount / 1_000_000).toFixed(2)} USDC.`,
      };
    },
  };
}

function createTabListTool(wallet: Wallet): Tool {
  return {
    definition: {
      name: "pay_tab_list",
      description:
        "List all tabs. Use to review tab health and optimize fund usage.\n\n" +
        "FLAGS: Idle tabs (open, no charges in 7+ days) are marked — consider closing " +
        "to free locked funds. Low-balance tabs are flagged for top-up. " +
        "Pending charges show amounts buffered but not yet settled on-chain.",
      inputSchema: zodToMcpSchema(TabListArgs),
    },
    handler: async () => {
      const tabs = await wallet.listTabs();

      const flagged = tabs.map((tab) => {
        if (tab.status !== "open") return { ...tab, idle: false, low_balance: false };
        const isIdle = tab.chargeCount === 0;
        const isLow = tab.maxChargePerCall > 0 &&
          tab.effectiveBalance < tab.maxChargePerCall * 10 &&
          tab.effectiveBalance > 0;
        return { ...tab, idle: isIdle, low_balance: isLow };
      });

      const openTabs = flagged.filter((t) => t.status === "open");
      const idleCount = openTabs.filter((t) => t.idle).length;
      const lowCount = openTabs.filter((t) => t.low_balance).length;
      const totalLocked = openTabs.reduce((sum, t) => sum + t.balanceRemaining, 0);

      const parts = [`${openTabs.length} open tab(s)`];
      if (totalLocked > 0) parts.push(`$${totalLocked.toFixed(2)} locked`);
      if (idleCount > 0) parts.push(`${idleCount} idle (close to free funds)`);
      if (lowCount > 0) parts.push(`${lowCount} low balance (consider top-up)`);

      return { tabs: flagged, summary: parts.join(", ") + "." };
    },
  };
}
