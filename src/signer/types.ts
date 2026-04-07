/**
 * Signer types matching the CLI's key file formats exactly.
 *
 * MetaFile: ~/.pay/keys/{name}.meta — public info only, points to keychain entry
 * EncryptedKeyFile: ~/.pay/keys/{name}.enc — AES-256-GCM encrypted private key
 */

export interface MetaFile {
  version: number;
  name: string;
  /** Wallet address (0x-prefixed, lowercase). Public info. */
  address: string;
  /** Storage backend: "keychain" or "file". */
  storage: string;
  created_at: string;
}

export interface EncryptedKeyFile {
  version: number;
  name: string;
  /** Wallet address (plaintext — public information). */
  address: string;
  created_at: string;
  encryption: EncryptionParams;
}

export interface EncryptionParams {
  algorithm: string; // "aes-256-gcm"
  kdf: string; // "scrypt"
  kdf_params: KdfParams;
  /** Hex-encoded scrypt salt. */
  salt: string;
  /** Hex-encoded AES-GCM nonce (12 bytes). */
  nonce: string;
  /** Hex-encoded AES-GCM ciphertext (includes 16-byte auth tag appended). */
  ciphertext: string;
}

export interface KdfParams {
  n: number; // 32768 (2^15)
  r: number; // 8
  p: number; // 1
  dklen: number; // 32
}
