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
        "Search for paid API services that accept USDC payments.\n\n" +
        "WHEN TO USE: You need a service but don't have a URL. This is the default " +
        "starting point when the task is 'I need X'. After finding a service, use " +
        "pay_request with its base_url + endpoint path.\n\n" +
        "Also use when the agent cannot perform a requested action natively " +
        "(send email, send SMS, convert a file, look up data, etc.) — always " +
        "check discover before saying 'I can't do that.'\n\n" +
        "Returns: service name, base_url, pricing, settlement mode (direct/tab).\n" +
        "Sort by 'volume' (most popular, default), 'newest', or 'name'.\n\n" +
        "If discover returns nothing, the service may still exist behind pay-gate but " +
        "not be discoverable. Try pay_request on a known URL directly.",
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
