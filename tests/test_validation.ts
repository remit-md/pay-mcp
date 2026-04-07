/**
 * Zod schema validation tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  StatusArgs,
  SendArgs,
  TabOpenArgs,
  TabCloseArgs,
  TabChargeArgs,
  TabTopupArgs,
  RequestArgs,
  DiscoverArgs,
  WebhookRegisterArgs,
  WebhookDeleteArgs,
  MintArgs,
  FundArgs,
  WithdrawArgs,
} from "../src/tools/validate.js";

const VALID_ADDR = "0x1111111111111111111111111111111111111111";

describe("StatusArgs", () => {
  it("accepts empty object", () => {
    assert.ok(StatusArgs.safeParse({}).success);
  });
  it("accepts valid wallet", () => {
    assert.ok(StatusArgs.safeParse({ wallet: VALID_ADDR }).success);
  });
  it("rejects invalid address", () => {
    assert.ok(!StatusArgs.safeParse({ wallet: "not-an-address" }).success);
  });
});

describe("SendArgs", () => {
  it("accepts valid input", () => {
    assert.ok(SendArgs.safeParse({ to: VALID_ADDR, amount: 1000000 }).success);
  });
  it("accepts with memo", () => {
    assert.ok(SendArgs.safeParse({ to: VALID_ADDR, amount: 1000000, memo: "test" }).success);
  });
  it("rejects missing to", () => {
    assert.ok(!SendArgs.safeParse({ amount: 1000000 }).success);
  });
  it("rejects zero amount", () => {
    assert.ok(!SendArgs.safeParse({ to: VALID_ADDR, amount: 0 }).success);
  });
  it("rejects negative amount", () => {
    assert.ok(!SendArgs.safeParse({ to: VALID_ADDR, amount: -1 }).success);
  });
  it("rejects bad address", () => {
    assert.ok(!SendArgs.safeParse({ to: "0xZZZ", amount: 1000000 }).success);
  });
});

describe("TabOpenArgs", () => {
  it("accepts valid input", () => {
    assert.ok(TabOpenArgs.safeParse({ provider: VALID_ADDR, amount: 5000000, max_charge: 100000 }).success);
  });
  it("rejects missing provider", () => {
    assert.ok(!TabOpenArgs.safeParse({ amount: 5000000, max_charge: 100000 }).success);
  });
  it("rejects zero amount", () => {
    assert.ok(!TabOpenArgs.safeParse({ provider: VALID_ADDR, amount: 0, max_charge: 100000 }).success);
  });
});

describe("TabCloseArgs", () => {
  it("accepts tab_id", () => {
    assert.ok(TabCloseArgs.safeParse({ tab_id: "tab-001" }).success);
  });
  it("rejects missing tab_id", () => {
    assert.ok(!TabCloseArgs.safeParse({}).success);
  });
});

describe("TabChargeArgs", () => {
  it("accepts valid input", () => {
    assert.ok(TabChargeArgs.safeParse({ tab_id: "tab-001", amount: 100000 }).success);
  });
  it("rejects zero amount", () => {
    assert.ok(!TabChargeArgs.safeParse({ tab_id: "tab-001", amount: 0 }).success);
  });
});

describe("TabTopupArgs", () => {
  it("accepts valid input", () => {
    assert.ok(TabTopupArgs.safeParse({ tab_id: "tab-001", amount: 5000000 }).success);
  });
});

describe("RequestArgs", () => {
  it("accepts URL only", () => {
    assert.ok(RequestArgs.safeParse({ url: "https://example.com" }).success);
  });
  it("accepts full options", () => {
    assert.ok(RequestArgs.safeParse({
      url: "https://example.com/api",
      method: "POST",
      headers: { "X-Key": "val" },
      body: '{"q":1}',
    }).success);
  });
  it("rejects invalid URL", () => {
    assert.ok(!RequestArgs.safeParse({ url: "not-a-url" }).success);
  });
});

describe("DiscoverArgs", () => {
  it("accepts empty object", () => {
    assert.ok(DiscoverArgs.safeParse({}).success);
  });
  it("accepts query + sort", () => {
    assert.ok(DiscoverArgs.safeParse({ query: "weather", sort: "volume" }).success);
  });
  it("rejects invalid sort", () => {
    assert.ok(!DiscoverArgs.safeParse({ sort: "invalid" }).success);
  });
});

describe("WebhookRegisterArgs", () => {
  it("accepts URL only", () => {
    assert.ok(WebhookRegisterArgs.safeParse({ url: "https://example.com/hook" }).success);
  });
  it("accepts with events", () => {
    assert.ok(WebhookRegisterArgs.safeParse({
      url: "https://example.com/hook",
      events: ["payment.completed"],
    }).success);
  });
  it("rejects invalid URL", () => {
    assert.ok(!WebhookRegisterArgs.safeParse({ url: "not-a-url" }).success);
  });
});

describe("WebhookDeleteArgs", () => {
  it("accepts id", () => {
    assert.ok(WebhookDeleteArgs.safeParse({ id: "wh-001" }).success);
  });
  it("rejects missing id", () => {
    assert.ok(!WebhookDeleteArgs.safeParse({}).success);
  });
});

describe("MintArgs", () => {
  it("accepts positive amount", () => {
    assert.ok(MintArgs.safeParse({ amount: 100 }).success);
  });
  it("rejects zero", () => {
    assert.ok(!MintArgs.safeParse({ amount: 0 }).success);
  });
  it("rejects negative", () => {
    assert.ok(!MintArgs.safeParse({ amount: -5 }).success);
  });
});

describe("FundArgs / WithdrawArgs", () => {
  it("accepts empty object", () => {
    assert.ok(FundArgs.safeParse({}).success);
    assert.ok(WithdrawArgs.safeParse({}).success);
  });
});
