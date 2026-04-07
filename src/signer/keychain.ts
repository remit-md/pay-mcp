/**
 * OS keychain backend for private key storage.
 *
 * Reads .meta files to find keychain-stored keys, then loads the raw
 * 32-byte private key via keytar (optional peer dependency).
 *
 * If keytar is not installed, loadKey() throws with a clear message.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MetaFile } from "./types.js";

const KEYCHAIN_SERVICE = "pay";

function keysDir(): string {
  return process.env.PAY_KEYS_DIR || join(homedir(), ".pay", "keys");
}

export function metaPath(name: string): string {
  return join(keysDir(), `${name}.meta`);
}

export function metaExists(name: string): boolean {
  return existsSync(metaPath(name));
}

export function loadMeta(name: string): MetaFile {
  const path = metaPath(name);
  const contents = readFileSync(path, "utf-8");
  return JSON.parse(contents) as MetaFile;
}

interface KeytarModule {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
}

async function getKeytar(): Promise<KeytarModule> {
  try {
    const mod = await import("keytar");
    // keytar is CJS — functions may be on .default or top-level
    return (mod.default ?? mod) as KeytarModule;
  } catch {
    throw new Error(
      "keytar is not installed. Install it as a peer dependency: npm install keytar",
    );
  }
}

/**
 * Generate a new private key, store it in the OS keychain, and write a .meta file.
 * Returns the raw 32-byte key as a hex string (no 0x prefix).
 */
export async function generateAndStore(name: string, address: string, privateKeyHex: string): Promise<void> {
  const keytar = await getKeytar();

  // Store raw bytes in OS keychain
  const bytes = Buffer.from(privateKeyHex, "hex");
  await keytar.setPassword(KEYCHAIN_SERVICE, name, bytes.toString("binary"));

  // Write .meta file
  const dir = keysDir();
  mkdirSync(dir, { recursive: true });
  const meta: MetaFile = {
    version: 2,
    name,
    address: address.toLowerCase(),
    storage: "keychain",
    created_at: new Date().toISOString(),
  };
  writeFileSync(metaPath(name), JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * Load a private key from the OS keychain via keytar.
 * Returns the raw 32-byte key as a hex string (no 0x prefix).
 */
export async function loadKey(name: string): Promise<string> {
  const keytar = await getKeytar();

  const secret = await keytar.getPassword(KEYCHAIN_SERVICE, name);
  if (!secret) {
    throw new Error(
      `No key '${name}' found in OS keychain.`,
    );
  }

  // keytar stores raw bytes as a binary string — convert to hex
  const bytes = Buffer.from(secret, "binary");
  if (bytes.length !== 32) {
    throw new Error(
      `Keychain key has wrong length: expected 32 bytes, got ${bytes.length}`,
    );
  }

  return bytes.toString("hex");
}
