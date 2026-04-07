/**
 * Private key → Ethereum address derivation via viem.
 */

import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Derive the checksummed Ethereum address from a hex private key.
 */
export function privateKeyToAddress(privateKeyHex: string): string {
  const key = (privateKeyHex.startsWith("0x") ? privateKeyHex : `0x${privateKeyHex}`) as Hex;
  const account = privateKeyToAccount(key);
  return account.address;
}
