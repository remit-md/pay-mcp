/**
 * OS keychain backend for private key storage.
 *
 * Reads .meta files to find keychain-stored keys, then loads the raw
 * 32-byte private key via keytar (optional peer dependency).
 *
 * If keytar is not installed, loadKey() throws with a clear message.
 */

import { readFileSync, existsSync } from "node:fs";
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

/**
 * Load a private key from the OS keychain via keytar.
 * Returns the raw 32-byte key as a hex string (no 0x prefix).
 */
export async function loadKey(name: string): Promise<string> {
  let keytar: typeof import("keytar");
  try {
    keytar = await import("keytar");
  } catch {
    throw new Error(
      "keytar is not installed. Install it as a peer dependency to use OS keychain keys, " +
        "or set PAYSKILL_SIGNER_KEY as a hex private key.",
    );
  }

  const secret = await keytar.getPassword(KEYCHAIN_SERVICE, name);
  if (!secret) {
    throw new Error(
      `No key '${name}' found in OS keychain. Run 'pay init' to create a wallet.`,
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
