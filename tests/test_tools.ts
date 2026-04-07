/**
 * Tool handler unit tests with mock PayAPI.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { buildTools, buildToolRegistry, callTool } from "../src/tools/index.js";
import { createMockApi, AGENT_ADDR, PROVIDER_ADDR } from "./fixtures.js";

// Dummy private key (testnet only, no real funds)
const TEST_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

function setup(overrides?: Parameters<typeof createMockApi>[0]) {
  const api = createMockApi(overrides);
  const tools = buildTools(api, TEST_KEY);
  const registry = buildToolRegistry(tools);
  return { api, tools, registry };
}

describe("tool registry", () => {
  it("builds 15 tools", () => {
    const { tools } = setup();
    assert.equal(tools.length, 15);
  });

  it("all tools have name, description, inputSchema", () => {
    const { tools } = setup();
    for (const tool of tools) {
      assert.ok(tool.definition.name, `Tool missing name`);
      assert.ok(tool.definition.description, `${tool.definition.name} missing description`);
      assert.ok(tool.definition.inputSchema, `${tool.definition.name} missing inputSchema`);
      assert.equal(tool.definition.inputSchema.type, "object");
    }
  });

  it("rejects unknown tool", async () => {
    const { registry } = setup();
    await assert.rejects(
      () => callTool("nonexistent", {}, registry),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Unknown tool"));
        return true;
      },
    );
  });
});

describe("pay_status", () => {
  it("returns balance and suggestion", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_status", {}, registry)) as Record<string, unknown>;
    assert.equal(result.address, AGENT_ADDR);
    assert.equal(result.balance_usdc, "50000000");
    assert.ok("suggestion" in result);
  });

  it("suggests funding when empty", async () => {
    const { registry } = setup({
      status: {
        address: AGENT_ADDR,
        balance_usdc: "0",
        open_tabs: 0,
        locked_usdc: "0",
        available_usdc: "0",
      },
    });
    const result = (await callTool("pay_status", {}, registry)) as Record<string, unknown>;
    assert.ok(typeof result.suggestion === "string");
    assert.ok((result.suggestion as string).includes("pay_fund"));
  });
});

describe("pay_send", () => {
  it("returns tx_hash and fee breakdown", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_send", {
      to: PROVIDER_ADDR,
      amount: 5000000,
      memo: "test",
    }, registry)) as Record<string, unknown>;
    assert.ok(result.tx_hash);
    assert.ok(result.summary);
    assert.ok(result.fee_breakdown);
  });
});

describe("pay_tab_open", () => {
  it("returns tab with summary", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_open", {
      provider: PROVIDER_ADDR,
      amount: 50000000,
      max_charge: 500000,
    }, registry)) as Record<string, unknown>;
    assert.equal(result.id, "tab-001");
    assert.ok((result.summary as string).includes("Opened tab"));
  });
});

describe("pay_tab_close", () => {
  it("returns distribution breakdown", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_close", {
      tab_id: "tab-001",
    }, registry)) as Record<string, unknown>;
    assert.ok(result.distribution);
    const dist = result.distribution as Record<string, unknown>;
    assert.ok(dist.provider_receives);
    assert.ok(dist.fee);
  });
});

describe("pay_tab_charge", () => {
  it("returns charge_id", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_charge", {
      tab_id: "tab-001",
      amount: 100000,
    }, registry)) as Record<string, unknown>;
    assert.equal(result.charge_id, "ch-001");
  });
});

describe("pay_tab_topup", () => {
  it("returns tab with summary", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_topup", {
      tab_id: "tab-001",
      amount: 10000000,
    }, registry)) as Record<string, unknown>;
    assert.ok((result.summary as string).includes("Topped up"));
  });
});

describe("pay_tab_list", () => {
  it("returns tabs with summary", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_list", {}, registry)) as Record<string, unknown>;
    assert.ok(Array.isArray(result.tabs));
    assert.ok(typeof result.summary === "string");
  });

  it("flags idle tabs", async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { registry } = setup({
      tabs: [{
        id: "tab-idle",
        agent: AGENT_ADDR,
        provider: PROVIDER_ADDR,
        balance_remaining: "5000000",
        total_charged: "0",
        max_charge_per_call: "100000",
        charge_count: 0,
        pending_charge_count: 0,
        pending_charge_total: "0",
        effective_balance: "5000000",
        status: "open" as const,
        contract_version: 3,
        created_at: oldDate,
        closed_at: null,
        auto_close_at: null,
      }],
    });
    const result = (await callTool("pay_tab_list", {}, registry)) as Record<string, unknown>;
    const tabs = result.tabs as Array<Record<string, unknown>>;
    assert.equal(tabs[0]?.idle, true);
    assert.ok((result.summary as string).includes("idle"));
  });
});

describe("pay_fund", () => {
  it("returns URL and wallet", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_fund", {}, registry)) as Record<string, unknown>;
    assert.ok(typeof result.url === "string");
    assert.equal(result.wallet, AGENT_ADDR);
  });
});

describe("pay_withdraw", () => {
  it("returns URL", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_withdraw", {}, registry)) as Record<string, unknown>;
    assert.ok(typeof result.url === "string");
  });
});

describe("pay_webhook_register", () => {
  it("returns webhook with secret", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_webhook_register", {
      url: "https://example.com/hook",
    }, registry)) as Record<string, unknown>;
    assert.ok(result.id);
    assert.ok(result.secret);
  });
});

describe("pay_webhook_list", () => {
  it("returns array", async () => {
    const { registry } = setup();
    const result = await callTool("pay_webhook_list", {}, registry);
    assert.ok(Array.isArray(result));
  });
});

describe("pay_webhook_delete", () => {
  it("returns deleted confirmation", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_webhook_delete", {
      id: "wh-001",
    }, registry)) as Record<string, unknown>;
    assert.equal(result.deleted, true);
  });
});

describe("pay_mint", () => {
  it("succeeds on testnet", async () => {
    const { registry } = setup({ chainId: 84532 });
    const result = (await callTool("pay_mint", {
      amount: 100,
    }, registry)) as Record<string, unknown>;
    assert.ok(result.tx_hash);
    assert.equal(result.amount_usdc, 100);
  });

  it("fails on mainnet", async () => {
    const { registry } = setup({ chainId: 8453 });
    await assert.rejects(
      () => callTool("pay_mint", { amount: 100 }, registry),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("testnet"));
        return true;
      },
    );
  });
});

describe("tool descriptions include SKILL.md context", () => {
  it("pay_send mentions confirmation thresholds", () => {
    const { tools } = setup();
    const send = tools.find((t) => t.definition.name === "pay_send");
    assert.ok(send?.definition.description.includes("Under $10"));
    assert.ok(send?.definition.description.includes("Over $100"));
  });

  it("pay_tab_open mentions sizing advice", () => {
    const { tools } = setup();
    const open = tools.find((t) => t.definition.name === "pay_tab_open");
    assert.ok(open?.definition.description.includes("$50"));
    assert.ok(open?.definition.description.includes("activation fee"));
  });

  it("pay_request mentions price context", () => {
    const { tools } = setup();
    const req = tools.find((t) => t.definition.name === "pay_request");
    assert.ok(req?.definition.description.includes("$0.001"));
    assert.ok(req?.definition.description.includes("suspicious"));
  });

  it("pay_discover mentions decision tree", () => {
    const { tools } = setup();
    const disc = tools.find((t) => t.definition.name === "pay_discover");
    assert.ok(disc?.definition.description.includes("don't have a URL"));
  });
});

describe("no secrets in tool output", () => {
  it("private key not in any tool result", async () => {
    const { registry } = setup();
    const names = ["pay_status", "pay_tab_list", "pay_fund", "pay_withdraw", "pay_webhook_list"];
    for (const name of names) {
      const result = await callTool(name, {}, registry);
      const str = JSON.stringify(result);
      assert.ok(!str.includes(TEST_KEY.slice(2)), `${name} leaks private key`);
    }
  });
});
