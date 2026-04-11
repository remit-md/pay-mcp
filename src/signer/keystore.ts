/**
 * Encrypted keystore decryption (AES-256-GCM + scrypt).
 *
 * Reads .enc files produced by the CLI's `pay init` or `pay signer backup`.
 * Format matches CLI's keystore.rs exactly.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { scryptSync, createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import type { EncryptedKeyFile } from "./types.js";

function keysDir(): string {
  return process.env.PAY_KEYS_DIR || join(homedir(), ".pay", "keys");
}

export function encPath(name: string): string {
  return join(keysDir(), `${name}.enc`);
}

export function encExists(name: string): boolean {
  return existsSync(encPath(name));
}

export function loadEncFile(name: string): EncryptedKeyFile {
  const path = encPath(name);
  const contents = readFileSync(path, "utf-8");
  return JSON.parse(contents) as EncryptedKeyFile;
}

/**
 * Decrypt an encrypted key file with a passphrase.
 * Returns the raw 32-byte private key as a hex string (no 0x prefix).
 *
 * Uses scrypt (n=32768, r=8, p=1) for key derivation and AES-256-GCM
 * for authenticated decryption. Matches the CLI's keystore.rs exactly.
 */
export function decrypt(keyFile: EncryptedKeyFile, passphrase: string): string {
  const { encryption } = keyFile;

  if (encryption.algorithm !== "aes-256-gcm") {
    throw new Error(
      `Unsupported encryption algorithm: ${encryption.algorithm}`,
    );
  }
  if (encryption.kdf !== "scrypt") {
    throw new Error(`Unsupported KDF: ${encryption.kdf}`);
  }

  const salt = Buffer.from(encryption.salt, "hex");
  const nonce = Buffer.from(encryption.nonce, "hex");
  const ciphertextWithTag = Buffer.from(encryption.ciphertext, "hex");

  if (nonce.length !== 12) {
    throw new Error(
      `Nonce must be 12 bytes, got ${nonce.length}`,
    );
  }

  // ciphertext = encrypted data (32 bytes) + GCM auth tag (16 bytes) = 48 bytes
  if (ciphertextWithTag.length !== 48) {
    throw new Error(
      `Ciphertext must be 48 bytes (32 data + 16 tag), got ${ciphertextWithTag.length}`,
    );
  }

  const { n, r, p, dklen } = encryption.kdf_params;

  // Derive decryption key via scrypt
  const derivedKey = scryptSync(passphrase, salt, dklen, {
    N: n,
    r,
    p,
    maxmem: 128 * n * r * 2, // scrypt memory limit
  });

  // Split ciphertext and auth tag (last 16 bytes)
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

  // AES-256-GCM decrypt
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, nonce);
  decipher.setAuthTag(authTag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      "Decryption failed: wrong passphrase or corrupted key file",
    );
  }

  if (plaintext.length !== 32) {
    throw new Error(`Decrypted key has wrong length: ${plaintext.length}`);
  }

  const hex = plaintext.toString("hex");

  // Zero the plaintext buffer
  plaintext.fill(0);

  return hex;
}

/**
 * Encrypt a private key and write it to a .enc file.
 * Returns the passphrase used for encryption (random, caller must store/display it).
 */
export function encryptAndStore(
  name: string,
  address: string,
  privateKeyHex: string,
): string {
  const passphrase = randomBytes(16).toString("hex");
  const salt = randomBytes(32);
  const nonce = randomBytes(12);

  const n = 32768;
  const r = 8;
  const p = 1;
  const dklen = 32;

  const derivedKey = scryptSync(passphrase, salt, dklen, {
    N: n,
    r,
    p,
    maxmem: 128 * n * r * 2,
  });

  const cipher = createCipheriv("aes-256-gcm", derivedKey, nonce);
  const keyBytes = Buffer.from(privateKeyHex, "hex");
  const encrypted = Buffer.concat([cipher.update(keyBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertextWithTag = Buffer.concat([encrypted, authTag]);

  // Zero sensitive buffers
  keyBytes.fill(0);

  const keyFile: EncryptedKeyFile = {
    version: 2,
    name,
    address: address.toLowerCase(),
    created_at: new Date().toISOString(),
    encryption: {
      algorithm: "aes-256-gcm",
      kdf: "scrypt",
      kdf_params: { n, r, p, dklen },
      salt: salt.toString("hex"),
      nonce: nonce.toString("hex"),
      ciphertext: ciphertextWithTag.toString("hex"),
    },
  };

  const dir = keysDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(encPath(name), JSON.stringify(keyFile, null, 2), "utf-8");

  return passphrase;
}
