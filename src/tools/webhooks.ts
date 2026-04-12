/**
 * pay_webhook_register, pay_webhook_list, pay_webhook_delete
 */

import type { Wallet } from "@pay-skill/sdk";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { WebhookRegisterArgs, WebhookListArgs, WebhookDeleteArgs } from "./validate.js";

const VALID_EVENTS = [
  "tab.opened", "tab.low_balance", "tab.closing_soon", "tab.closed",
  "tab.topped_up", "tab.settled", "payment.completed", "x402.settled",
];

export function createWebhookTools(wallet: Wallet): Tool[] {
  return [
    {
      definition: {
        name: "pay_webhook_register",
        description:
          "Register a webhook to receive real-time payment event notifications.\n\n" +
          "Events: " + VALID_EVENTS.join(", ") + "\n\n" +
          "If no events specified, all are delivered. Delivery: HTTPS POST with " +
          "HMAC-SHA256 signature for verification. At-least-once with retries.",
        inputSchema: zodToMcpSchema(WebhookRegisterArgs),
      },
      handler: async (args) => {
        const { url, events, secret } = args as {
          url: string; events?: string[]; secret?: string;
        };
        return wallet.registerWebhook(url, events, secret);
      },
    },
    {
      definition: {
        name: "pay_webhook_list",
        description: "List all registered webhooks for your wallet.",
        inputSchema: zodToMcpSchema(WebhookListArgs),
      },
      handler: async () => wallet.listWebhooks(),
    },
    {
      definition: {
        name: "pay_webhook_delete",
        description: "Delete a webhook registration by its ID.",
        inputSchema: zodToMcpSchema(WebhookDeleteArgs),
      },
      handler: async (args) => {
        const { id } = args as { id: string };
        await wallet.deleteWebhook(id);
        return { deleted: true, id };
      },
    },
  ];
}
