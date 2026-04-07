/**
 * Key resolution chain — mirrors the CLI's resolve_key() exactly.
 *
 * 1. PAYSKILL_SIGNER_KEY as raw 64-hex-char key → use directly
 * 2. ~/.pay/keys/default.meta exists + storage=keychain → keytar.getPassword("pay", name)
 * 3. ~/.pay/keys/default.enc exists + PAYSKILL_SIGNER_KEY as password → scrypt+AES decrypt
 * 4. Error: "No wallet found"
 */

import { metaExists, loadMeta, loadKey as loadKeyFromKeychain } from "./keychain.js";
import { encExists, loadEncFile, decrypt } from "./keystore.js";

export interface ResolvedKey {
  /** Raw private key hex (no 0x prefix, 64 chars). */
  privateKeyHex: string;
  /** How the key was resolved, for diagnostics. */
  source: "env" | "keychain" | "enc";
}

/**
 * Resolve the signing key using the priority chain.
 * Logs diagnostics to stderr.
 */
export async function resolveKey(): Promise<ResolvedKey> {
  const envVal = process.env.PAYSKILL_SIGNER_KEY;

  // 1. Raw hex key from env
  if (envVal) {
    const clean = envVal.startsWith("0x") ? envVal.slice(2) : envVal;
    if (clean.length === 64 && /^[0-9a-fA-F]{64}$/.test(clean)) {
      return { privateKeyHex: clean, source: "env" };
    }
  }

  // 2. OS keychain via .meta
  if (metaExists("default")) {
    try {
      const meta = loadMeta("default");
      if (meta.storage === "keychain") {
        console.error("pay-mcp: found default.meta (keychain), loading from OS keychain...");
        const hex = await loadKeyFromKeychain("default");
        return { privateKeyHex: hex, source: "keychain" };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`pay-mcp: keychain load failed, trying .enc: ${msg}`);
    }
  }

  // 3. .enc file + env value as password
  if (encExists("default")) {
    if (!envVal) {
      throw new Error(
        "Found encrypted keystore at ~/.pay/keys/default.enc but PAYSKILL_SIGNER_KEY is not set. " +
          "Set it to the keystore password to decrypt.",
      );
    }
    console.error("pay-mcp: found default.enc, decrypting with PAYSKILL_SIGNER_KEY as password...");
    const keyFile = loadEncFile("default");
    const hex = decrypt(keyFile, envVal);
    return { privateKeyHex: hex, source: "enc" };
  }

  // 4. Error
  throw new Error(
    "No wallet found. Set PAYSKILL_SIGNER_KEY (hex private key or keystore password) or run 'pay init'.",
  );
}
