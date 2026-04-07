/**
 * Key resolution chain — standalone, no CLI dependency.
 *
 * 1. ~/.pay/keys/default.meta exists + storage=keychain → keytar.getPassword("pay", name)
 * 2. ~/.pay/keys/default.enc exists + PAYSKILL_SIGNER_KEY as password → scrypt+AES decrypt
 * 3. PAYSKILL_SIGNER_KEY as raw 64-hex-char key → use directly (override/dev)
 * 4. No key found → auto-generate, store in OS keychain, write .meta
 */

import { metaExists, loadMeta, loadKey as loadKeyFromKeychain, generateAndStore } from "./keychain.js";
import { encExists, loadEncFile, decrypt } from "./keystore.js";
import { privateKeyToAddress } from "../crypto/address.js";
import { randomBytes } from "node:crypto";

export interface ResolvedKey {
  /** Raw private key hex (no 0x prefix, 64 chars). */
  privateKeyHex: string;
  /** How the key was resolved, for diagnostics. */
  source: "keychain" | "enc" | "env" | "generated";
}

/**
 * Resolve the signing key using the priority chain.
 * Auto-generates and stores in OS keychain if no key exists.
 */
export async function resolveKey(): Promise<ResolvedKey> {
  const envVal = process.env.PAYSKILL_SIGNER_KEY;

  // 1. OS keychain via .meta (primary path)
  if (metaExists("default")) {
    try {
      const meta = loadMeta("default");
      if (meta.storage === "keychain") {
        console.error("pay-mcp: loading key from OS keychain...");
        const hex = await loadKeyFromKeychain("default");
        return { privateKeyHex: hex, source: "keychain" };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`pay-mcp: keychain load failed: ${msg}`);
      // Fall through to other methods
    }
  }

  // 2. Encrypted keystore + password
  if (encExists("default") && envVal) {
    console.error("pay-mcp: decrypting keystore with PAYSKILL_SIGNER_KEY...");
    const keyFile = loadEncFile("default");
    const hex = decrypt(keyFile, envVal);
    return { privateKeyHex: hex, source: "enc" };
  }

  // 3. Raw hex key from env (override/dev)
  if (envVal) {
    const clean = envVal.startsWith("0x") ? envVal.slice(2) : envVal;
    if (clean.length === 64 && /^[0-9a-fA-F]{64}$/.test(clean)) {
      return { privateKeyHex: clean, source: "env" };
    }
    // If .enc exists but envVal isn't a valid raw key, it was meant as a password
    if (encExists("default")) {
      throw new Error(
        "Found encrypted keystore at ~/.pay/keys/default.enc but decryption failed. " +
          "Check that PAYSKILL_SIGNER_KEY is the correct keystore password.",
      );
    }
  }

  // 4. Auto-generate and store in OS keychain
  console.error("pay-mcp: no wallet found, generating new keypair...");
  const privateKeyHex = randomBytes(32).toString("hex");
  const address = privateKeyToAddress(privateKeyHex);

  try {
    await generateAndStore("default", address, privateKeyHex);
    console.error(`pay-mcp: wallet created and stored in OS keychain: ${address}`);
    return { privateKeyHex, source: "generated" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to store generated key in OS keychain: ${msg}. ` +
        "Set PAYSKILL_SIGNER_KEY env var as a fallback.",
    );
  }
}
