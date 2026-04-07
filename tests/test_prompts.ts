/**
 * Prompt handler tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listPrompts, getPrompt } from "../src/prompts/index.js";

describe("listPrompts", () => {
  it("returns 3 prompts", () => {
    const prompts = listPrompts();
    assert.equal(prompts.length, 3);
  });

  it("all prompts have name and description", () => {
    for (const p of listPrompts()) {
      assert.ok(p.name);
      assert.ok(p.description);
    }
  });

  it("includes expected prompt names", () => {
    const names = listPrompts().map((p) => p.name);
    assert.ok(names.includes("pay-for-service"));
    assert.ok(names.includes("review-tabs"));
    assert.ok(names.includes("fund-wallet"));
  });

  it("pay-for-service has required 'service' argument", () => {
    const prompt = listPrompts().find((p) => p.name === "pay-for-service");
    assert.ok(prompt?.arguments);
    const arg = prompt.arguments.find((a) => a.name === "service");
    assert.ok(arg);
    assert.equal(arg.required, true);
  });
});

describe("getPrompt", () => {
  it("pay-for-service returns user/assistant pair", () => {
    const messages = getPrompt("pay-for-service", { service: "weather API" });
    assert.ok(messages.length >= 2);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[1]?.role, "assistant");
    assert.equal(messages[0]?.content.type, "text");
    assert.ok(messages[0]?.content.text.includes("weather API"));
  });

  it("review-tabs returns messages without required args", () => {
    const messages = getPrompt("review-tabs", {});
    assert.ok(messages.length >= 2);
    assert.ok(messages[1]?.content.text.includes("pay_tab_list"));
  });

  it("fund-wallet returns messages", () => {
    const messages = getPrompt("fund-wallet", {});
    assert.ok(messages.length >= 2);
    assert.ok(messages[1]?.content.text.includes("pay_fund"));
  });

  it("rejects unknown prompt", () => {
    assert.throws(
      () => getPrompt("nonexistent", {}),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Unknown prompt"));
        return true;
      },
    );
  });

  it("rejects missing required argument", () => {
    assert.throws(
      () => getPrompt("pay-for-service", {}),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Missing required"));
        return true;
      },
    );
  });
});
