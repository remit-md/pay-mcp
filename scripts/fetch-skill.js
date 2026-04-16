#!/usr/bin/env node
/**
 * Fetch the canonical Pay skill bundle from the pay-docs repo.
 *
 * Runs automatically via the "prepack" npm lifecycle hook before
 * `npm pack` and `npm publish` — see package.json. The fetched files
 * are written into skills/pay/ and picked up by the `files` field in
 * package.json so they land in the published tarball.
 *
 * Single source of truth for the skill content is pay-skill/pay-docs
 * at skills/pay/, which also serves the same bundle at
 * https://pay-skill.com/skills/pay. This keeps the npm package and
 * the hosted copy locked together instead of drifting.
 *
 * Environment overrides:
 *   PAYSKILL_SKILL_REF  Branch, tag, or commit SHA in pay-docs
 *                       (default: main)
 *   PAYSKILL_SKILL_SRC  Full base URL override for the fetch
 *                       (useful for local testing against a fork)
 *                       e.g. file:///path/to/checkout/skills/pay
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "pay-skill/pay-docs";
const REF = process.env.PAYSKILL_SKILL_REF || "main";
const DEFAULT_BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/skills/pay`;
const BASE = process.env.PAYSKILL_SKILL_SRC || DEFAULT_BASE;

// Files that make up the skill bundle. Keep in sync with
// pay-skill/pay-docs:skills/pay/. If new references are added there,
// add them here too.
const FILES = [
  "SKILL.md",
  "references/a2a.md",
  "references/adoption.md",
  "references/discovery.md",
  "references/errors.md",
  "references/examples.md",
  "references/funding.md",
  "references/rules.md",
  "references/tabs.md",
  "references/x402.md",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "skills", "pay");

async function fetchText(url) {
  if (url.startsWith("file://")) {
    const { readFile } = await import("node:fs/promises");
    return readFile(fileURLToPath(url), "utf8");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
  return res.text();
}

async function main() {
  console.log(`[fetch-skill] source: ${BASE}`);
  console.log(`[fetch-skill] writing to: ${OUT_DIR}`);

  // Clean out any stale content from a previous run so removed files
  // in pay-docs don't leak into the tarball as ghosts.
  await rm(OUT_DIR, { recursive: true, force: true });

  let totalBytes = 0;
  for (const rel of FILES) {
    const url = `${BASE}/${rel}`;
    let body;
    try {
      body = await fetchText(url);
    } catch (err) {
      throw new Error(`failed to fetch ${rel}: ${err.message}`);
    }
    if (!body || body.length === 0) {
      throw new Error(`${rel} is empty — refusing to publish a broken bundle`);
    }
    const outPath = join(OUT_DIR, rel);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, body, "utf8");
    totalBytes += body.length;
    console.log(`[fetch-skill]  ${rel} (${body.length} bytes)`);
  }

  console.log(
    `[fetch-skill] done: ${FILES.length} files, ${totalBytes} bytes total`,
  );
}

main().catch((err) => {
  console.error(`[fetch-skill] FAILED: ${err.message}`);
  process.exit(1);
});
