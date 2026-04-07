/**
 * EIP-2612 permit signing for USDC approvals.
 *
 * Flow:
 * 1. POST /permit/prepare { amount, spender } — server returns EIP-712 hash, nonce, deadline
 * 2. MCP signs the hash with the agent's private key
 * 3. Returns (nonce, deadline, v, r, s) for the payment request body
 *
 * The server computes the full EIP-712 typed data. We only sign a hash.
 */

import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface PermitSignature {
  nonce: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
}

/**
 * Sign a permit hash returned by the server's /permit/prepare endpoint.
 *
 * @param privateKey - Agent's private key (0x-prefixed hex)
 * @param hash - 32-byte EIP-712 hash from server (0x-prefixed hex)
 * @param nonce - Permit nonce from server
 * @param deadline - Permit deadline from server
 */
export async function signPermit(
  privateKey: Hex,
  hash: Hex,
  nonce: string,
  deadline: number,
): Promise<PermitSignature> {
  const account = privateKeyToAccount(privateKey);

  // Sign the raw hash (not typed data — the server already computed the EIP-712 hash)
  const signature = await account.sign({ hash });

  // Parse 65-byte signature into v, r, s
  const sigHex = signature.slice(2); // remove 0x
  const r = `0x${sigHex.slice(0, 64)}`;
  const s = `0x${sigHex.slice(64, 128)}`;
  const v = parseInt(sigHex.slice(128, 130), 16);

  return { nonce, deadline, v, r, s };
}
