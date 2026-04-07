/**
 * Acceptance tests — real testnet (Base Sepolia).
 *
 * Run: PAY_NETWORK=testnet PAYSKILL_SIGNER_KEY=0x... npm run test:acceptance
 *
 * Tests every tool against a live server. Requires funded wallet.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { buildTools, buildToolRegistry, callTool } from "../src/tools/index.js";
import { listResources, listResourceTemplates, readResource } from "../src/resources/index.js";
import { listPrompts, getPrompt } from "../src/prompts/index.js";
import { createTestApi, mintTestUsdc, waitForBalance } from "./setup.js";

const { api, privateKey, address } = createTestApi();
const tools = buildTools(api, privateKey);
const registry = buildToolRegistry(tools);

describe("acceptance: setup", () => {
  before(async () => {
    console.log(`  wallet: ${address}`);
    console.log(`  minting 100 testnet USDC...`);
    const txHash = await mintTestUsdc(api, 100);
    console.log(`  mint tx: ${txHash}`);
    await waitForBalance(api, 50);
    console.log(`  balance confirmed`);
  });

  it("wallet has funds", async () => {
    const result = (await callTool("pay_status", {}, registry)) as Record<string, unknown>;
    assert.ok(Number(result.available_usdc) > 0);
  });
});

describe("acceptance: pay_status", () => {
  it("returns balance and address", async () => {
    const result = (await callTool("pay_status", {}, registry)) as Record<string, unknown>;
    assert.equal(result.address, address);
    assert.ok(result.balance_usdc);
    assert.ok("suggestion" in result);
  });
});

describe("acceptance: pay_mint", () => {
  it("mints testnet USDC", async () => {
    const result = (await callTool("pay_mint", { amount: 10 }, registry)) as Record<string, unknown>;
    assert.ok(result.tx_hash);
    assert.equal(result.amount_usdc, 10);
    assert.equal(result.network, "Base Sepolia (testnet)");
  });
});

describe("acceptance: pay_fund", () => {
  it("returns fund link", async () => {
    const result = (await callTool("pay_fund", {}, registry)) as Record<string, unknown>;
    assert.ok(typeof result.url === "string");
    assert.ok((result.url as string).includes("pay-skill.com") || (result.url as string).includes("testnet"));
    assert.ok(result.expires_at);
    assert.equal(result.wallet, address);
  });
});

describe("acceptance: pay_withdraw", () => {
  it("returns withdraw link", async () => {
    const result = (await callTool("pay_withdraw", {}, registry)) as Record<string, unknown>;
    assert.ok(typeof result.url === "string");
    assert.ok(result.expires_at);
  });
});

describe("acceptance: pay_webhook_register/list/delete", () => {
  let webhookId: string;

  it("registers webhook", async () => {
    const result = (await callTool("pay_webhook_register", {
      url: "https://httpbin.org/post",
      events: ["payment.completed"],
    }, registry)) as Record<string, unknown>;
    assert.ok(result.id);
    assert.ok(result.secret);
    webhookId = result.id as string;
  });

  it("lists webhooks", async () => {
    const result = await callTool("pay_webhook_list", {}, registry);
    assert.ok(Array.isArray(result));
    const found = (result as Array<Record<string, unknown>>).find(
      (w) => w.id === webhookId,
    );
    assert.ok(found, "Registered webhook not found in list");
  });

  it("deletes webhook", async () => {
    const result = (await callTool("pay_webhook_delete", {
      id: webhookId,
    }, registry)) as Record<string, unknown>;
    assert.equal(result.deleted, true);
  });
});

describe("acceptance: pay_tab_list", () => {
  it("returns tab list with summary", async () => {
    const result = (await callTool("pay_tab_list", {}, registry)) as Record<string, unknown>;
    assert.ok(Array.isArray(result.tabs));
    assert.ok(typeof result.summary === "string");
  });
});

describe("acceptance: pay_discover", () => {
  it("returns services array", async () => {
    const result = (await callTool("pay_discover", {}, registry)) as Record<string, unknown>;
    assert.ok("services" in result);
    assert.ok("count" in result);
  });
});

describe("acceptance: resources", () => {
  it("reads pay://wallet/status", async () => {
    const result = await readResource("pay://wallet/status", api);
    const data = JSON.parse(result.text);
    assert.equal(data.address, address);
  });

  it("reads pay://wallet/address", async () => {
    const result = await readResource("pay://wallet/address", api);
    const data = JSON.parse(result.text);
    assert.equal(data.address, address);
  });

  it("reads pay://network", async () => {
    const result = await readResource("pay://network", api);
    const data = JSON.parse(result.text);
    assert.equal(data.chain_id, 84532);
  });

  it("reads pay://wallet/tabs", async () => {
    const result = await readResource("pay://wallet/tabs", api);
    const data = JSON.parse(result.text);
    assert.ok(Array.isArray(data));
  });
});

describe("acceptance: prompts", () => {
  it("all 3 prompts return valid messages", () => {
    const messages1 = getPrompt("pay-for-service", { service: "weather" });
    assert.ok(messages1.length >= 2);

    const messages2 = getPrompt("review-tabs", {});
    assert.ok(messages2.length >= 2);

    const messages3 = getPrompt("fund-wallet", {});
    assert.ok(messages3.length >= 2);
  });
});
