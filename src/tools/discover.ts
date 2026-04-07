/**
 * pay_discover — search for discoverable paid API services.
 *
 * Public endpoint, no auth required. Sorted by daily call volume by default.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { DiscoverArgs } from "./validate.js";
import type { DiscoverService } from "../types.js";

export function createDiscoverTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_discover",
      description:
        "Search for paid API services that accept USDC payments via x402. " +
        "Returns services with their base URL, pricing, and settlement mode. " +
        "Use the base_url from results with pay_request to call the service.\n\n" +
        "Examples: 'weather API', 'image generation', 'translation'\n" +
        "Sort by 'volume' (most popular), 'newest', or 'name'.",
      inputSchema: zodToMcpSchema(DiscoverArgs),
    },
    handler: async (args) => {
      const { query, sort, category, settlement } = args as {
        query?: string;
        sort?: string;
        category?: string;
        settlement?: string;
      };

      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (sort) params.set("sort", sort);
      if (category) params.set("category", category);
      if (settlement) params.set("settlement", settlement);

      const qs = params.toString();
      const url = `${api.getApiUrl()}/discover${qs ? `?${qs}` : ""}`;
      const resp = await fetch(url);

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`Discover failed: ${resp.status} ${body}`);
      }

      const data = (await resp.json()) as { services: DiscoverService[] };

      return {
        services: data.services,
        count: data.services.length,
        tip: data.services.length > 0
          ? "Use pay_request with a service's base_url + endpoint path to call it."
          : query
            ? `No services found for "${query}". Try broader keywords.`
            : "No services registered yet.",
      };
    },
  };
}
