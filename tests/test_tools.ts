/**
 * Tool handler unit tests with mock Wallet.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTools, buildToolRegistry, callTool } from "../src/tools/index.js";
import { createMockWallet, AGENT_ADDR, PROVIDER_ADDR } from "./fixtures.js";

function setup(overrides?: Parameters<typeof createMockWallet>[0]) {
  const wallet = createMockWallet(overrides);
  const tools = buildTools(wallet);
  const registry = buildToolRegistry(tools);
  return { wallet, tools, registry };
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
    assert.equal(result.wallet, AGENT_ADDR);
    assert.ok("suggestion" in result);
    assert.ok(result.balance);
  });

  it("suggests funding when empty", async () => {
    const { registry } = setup({
      status: {
        address: AGENT_ADDR,
        balance: { total: 0, locked: 0, available: 0 },
        openTabs: 0,
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
  it("returns chargeId", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_tab_charge", {
      tab_id: "tab-001",
      amount: 100000,
    }, registry)) as Record<string, unknown>;
    assert.equal(result.chargeId, "ch-001");
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

  it("flags idle tabs (zero charges)", async () => {
    const { registry } = setup({
      tabs: [{
        id: "tab-idle",
        provider: PROVIDER_ADDR,
        amount: 5.0,
        balanceRemaining: 5.0,
        totalCharged: 0,
        chargeCount: 0,
        maxChargePerCall: 0.1,
        totalWithdrawn: 0,
        status: "open" as const,
        pendingChargeCount: 0,
        pendingChargeTotal: 0,
        effectiveBalance: 5.0,
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
  it("returns webhook id", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_webhook_register", {
      url: "https://example.com/hook",
    }, registry)) as Record<string, unknown>;
    assert.ok(result.id);
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
  it("returns tx_hash", async () => {
    const { registry } = setup();
    const result = (await callTool("pay_mint", {
      amount: 100,
    }, registry)) as Record<string, unknown>;
    assert.ok(result.tx_hash);
    assert.equal(result.amount_usdc, 100);
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
