/**
 * Tab tools — open, close, charge, topup, list.
 *
 * Tabs are pre-funded metered accounts. Agent locks USDC, provider charges
 * incrementally. Charges are batched on-chain for gas efficiency.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { TabOpenArgs, TabCloseArgs, TabChargeArgs, TabTopupArgs, TabListArgs } from "./validate.js";
import { signPermit } from "../crypto/permit.js";
import type { Hex } from "viem";
import type { Tab } from "../types.js";

export function createTabTools(api: PayAPI, privateKey: Hex): Tool[] {
  return [
    createTabOpenTool(api, privateKey),
    createTabCloseTool(api),
    createTabChargeTool(api),
    createTabTopupTool(api, privateKey),
    createTabListTool(api),
  ];
}

function createTabOpenTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_tab_open",
      description:
        "Open a pre-funded tab with a provider. Minimum $5.00 (5000000 micro-USDC). " +
        "The agent locks USDC; the provider charges incrementally against it.\n\n" +
        "SIZING ADVICE: For API usage, $50 is a good starting point. The activation " +
        "fee is max($0.10, 1% of amount) — non-refundable. Unused balance is returned " +
        "when the tab is closed. Tabs auto-close after 30 days of inactivity.\n\n" +
        "max_charge limits what the provider can charge per call (contract-enforced).",
      inputSchema: zodToMcpSchema(TabOpenArgs),
    },
    handler: async (args) => {
      const { provider, amount, max_charge } = args as {
        provider: string;
        amount: number;
        max_charge: number;
      };

      const contracts = await api.getContracts();
      const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
        "/permit/prepare",
        { amount, spender: contracts.pay_tab },
      );
      const permit = await signPermit(
        privateKey,
        prepare.hash as Hex,
        prepare.nonce,
        prepare.deadline,
      );

      const tab = await api.post<Tab>("/tabs", {
        provider,
        amount,
        max_charge_per_call: max_charge,
        permit,
      });

      const usdAmount = (amount / 1_000_000).toFixed(2);
      const activationFee = Math.max(100_000, Math.floor(amount * 0.01));
      const usdFee = (activationFee / 1_000_000).toFixed(2);
      return {
        ...tab,
        summary: `Opened tab ${tab.id} with $${usdAmount} USDC. Activation fee: $${usdFee}. ` +
          `Provider can charge up to ${max_charge} per call.`,
      };
    },
  };
}

function createTabCloseTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_tab_close",
      description:
        "Close a tab. Either the agent or provider can close unilaterally. " +
        "Distribution: provider gets charged amount minus 1% fee, agent gets unused balance.",
      inputSchema: zodToMcpSchema(TabCloseArgs),
    },
    handler: async (args) => {
      const { tab_id } = args as { tab_id: string };
      const tab = await api.post<Tab>(`/tabs/${tab_id}/close`, {});
      return {
        ...tab,
        summary: `Closed tab ${tab_id}. Status: ${tab.status}.`,
      };
    },
  };
}

function createTabChargeTool(api: PayAPI): Tool {
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
      const result = await api.post<{ charge_id: string }>(`/tabs/${tab_id}/charge`, { amount });
      return result;
    },
  };
}

function createTabTopupTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_tab_topup",
      description:
        "Add more USDC to an open tab. Only the agent (tab opener) can top up. " +
        "Uses EIP-2612 permit for gas-free approval.",
      inputSchema: zodToMcpSchema(TabTopupArgs),
    },
    handler: async (args) => {
      const { tab_id, amount } = args as { tab_id: string; amount: number };

      const contracts = await api.getContracts();
      const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
        "/permit/prepare",
        { amount, spender: contracts.pay_tab },
      );
      const permit = await signPermit(
        privateKey,
        prepare.hash as Hex,
        prepare.nonce,
        prepare.deadline,
      );

      const tab = await api.post<Tab>(`/tabs/${tab_id}/topup`, { amount, permit });
      const usdAmount = (amount / 1_000_000).toFixed(2);
      return {
        ...tab,
        summary: `Topped up tab ${tab_id} with $${usdAmount} USDC.`,
      };
    },
  };
}

function createTabListTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_tab_list",
      description:
        "List all your tabs (open and recently closed). " +
        "Check for idle tabs (open but no recent charges) — consider closing them " +
        "to free locked funds. Pending charges show buffered but unsettled amounts.",
      inputSchema: zodToMcpSchema(TabListArgs),
    },
    handler: async () => {
      const tabs = await api.get<Tab[]>("/tabs");

      // Flag idle tabs (open, no charges in a while)
      const now = Date.now();
      const idleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      const flagged = tabs.map((tab) => {
        const isIdle =
          tab.status === "open" &&
          tab.charge_count === 0 &&
          now - new Date(tab.created_at).getTime() > idleThresholdMs;
        return { ...tab, idle: isIdle };
      });

      const openCount = tabs.filter((t) => t.status === "open").length;
      const idleCount = flagged.filter((t) => t.idle).length;

      return {
        tabs: flagged,
        summary: `${openCount} open tab(s)${idleCount > 0 ? `, ${idleCount} idle (consider closing)` : ""}.`,
      };
    },
  };
}
