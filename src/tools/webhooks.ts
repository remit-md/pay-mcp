/**
 * pay_webhook_register — register a webhook for payment events.
 * pay_webhook_list — list all registered webhooks.
 * pay_webhook_delete — delete a webhook by ID.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import {
  WebhookRegisterArgs,
  WebhookListArgs,
  WebhookDeleteArgs,
} from "./validate.js";
import type { WebhookRegistration } from "../types.js";

const VALID_EVENTS = [
  "tab.opened",
  "tab.low_balance",
  "tab.closing_soon",
  "tab.closed",
  "tab.topped_up",
  "tab.settled",
  "payment.completed",
  "x402.settled",
];

export function createWebhookTools(api: PayAPI): Tool[] {
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
          url: string;
          events?: string[];
          secret?: string;
        };
        const body: Record<string, unknown> = { url };
        if (events) body.events = events;
        if (secret) body.secret = secret;
        return api.post<WebhookRegistration>("/webhooks", body);
      },
    },
    {
      definition: {
        name: "pay_webhook_list",
        description: "List all registered webhooks for your wallet.",
        inputSchema: zodToMcpSchema(WebhookListArgs),
      },
      handler: async () => {
        return api.get<WebhookRegistration[]>("/webhooks");
      },
    },
    {
      definition: {
        name: "pay_webhook_delete",
        description: "Delete a webhook registration by its ID.",
        inputSchema: zodToMcpSchema(WebhookDeleteArgs),
      },
      handler: async (args) => {
        const { id } = args as { id: string };
        await api.del(`/webhooks/${id}`);
        return { deleted: true, id };
      },
    },
  ];
}
