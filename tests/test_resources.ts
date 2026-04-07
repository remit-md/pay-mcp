/**
 * Resource handler tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listResources, listResourceTemplates, readResource } from "../src/resources/index.js";
import { createMockApi, AGENT_ADDR } from "./fixtures.js";

describe("listResources", () => {
  it("returns 4 static resources", () => {
    const resources = listResources();
    assert.equal(resources.length, 4);
    for (const r of resources) {
      assert.ok(r.uri);
      assert.ok(r.name);
      assert.ok(r.description);
      assert.equal(r.mimeType, "application/json");
    }
  });

  it("includes expected URIs", () => {
    const uris = listResources().map((r) => r.uri);
    assert.ok(uris.includes("pay://wallet/status"));
    assert.ok(uris.includes("pay://wallet/tabs"));
    assert.ok(uris.includes("pay://wallet/address"));
    assert.ok(uris.includes("pay://network"));
  });
});

describe("listResourceTemplates", () => {
  it("returns 1 template", () => {
    const templates = listResourceTemplates();
    assert.equal(templates.length, 1);
    assert.equal(templates[0]?.uriTemplate, "pay://tab/{tab_id}");
  });
});

describe("readResource", () => {
  const api = createMockApi();

  it("pay://wallet/status returns balance", async () => {
    const result = await readResource("pay://wallet/status", api);
    assert.equal(result.mimeType, "application/json");
    const data = JSON.parse(result.text);
    assert.equal(data.address, AGENT_ADDR);
    assert.ok(data.balance_usdc);
  });

  it("pay://wallet/tabs returns array", async () => {
    const result = await readResource("pay://wallet/tabs", api);
    const data = JSON.parse(result.text);
    assert.ok(Array.isArray(data));
  });

  it("pay://wallet/address returns address", async () => {
    const result = await readResource("pay://wallet/address", api);
    const data = JSON.parse(result.text);
    assert.equal(data.address, AGENT_ADDR);
  });

  it("pay://network returns chain info", async () => {
    const result = await readResource("pay://network", api);
    const data = JSON.parse(result.text);
    assert.equal(data.chain_id, 84532);
    assert.ok(data.api_url);
    assert.ok(data.contracts);
  });

  it("pay://tab/{id} returns tab detail", async () => {
    const result = await readResource("pay://tab/tab-001", api);
    const data = JSON.parse(result.text);
    assert.equal(data.id, "tab-001");
  });

  it("rejects unknown URI", async () => {
    await assert.rejects(
      () => readResource("pay://unknown/thing", api),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Unknown resource"));
        return true;
      },
    );
  });
});
