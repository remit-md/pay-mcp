/**
 * EIP-3009 TransferWithAuthorization signing for x402 direct settlement.
 *
 * Unlike EIP-2612 permits (which need a nonce from the USDC contract),
 * EIP-3009 uses a random nonce chosen by the signer. Fully local — no
 * server round-trip needed.
 *
 * Domain: { name: "USD Coin", version: "2", chainId, verifyingContract: usdcAddress }
 * Type: TransferWithAuthorization(address from, address to, uint256 value,
 *       uint256 validAfter, uint256 validBefore, bytes32 nonce)
 */

import { type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

export interface TransferAuthorization {
  from: string;
  to: string;
  amount: number;
  valid_after: string;
  valid_before: string;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Sign an EIP-3009 TransferWithAuthorization for x402 direct settlement.
 *
 * @param privateKey - Agent's private key (0x-prefixed hex)
 * @param to - Provider address
 * @param amount - Amount in micro-USDC (6 decimals)
 * @param chainId - Chain ID (8453 for mainnet, 84532 for testnet)
 * @param usdcAddress - USDC contract address on this chain
 */
export async function signTransferAuthorization(
  privateKey: Hex,
  to: Address,
  amount: number,
  chainId: number,
  usdcAddress: Address,
): Promise<TransferAuthorization> {
  const account = privateKeyToAccount(privateKey);
  const nonce = ("0x" + randomBytes(32).toString("hex")) as Hex;

  const signature = await account.signTypedData({
    domain: {
      name: "USD Coin",
      version: "2",
      chainId,
      verifyingContract: usdcAddress,
    },
    types: TRANSFER_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: account.address,
      to,
      value: BigInt(amount),
      validAfter: 0n,
      validBefore: 0n,
      nonce,
    },
  });

  // Parse 65-byte signature into v, r, s
  const sigHex = signature.slice(2);
  const r = `0x${sigHex.slice(0, 64)}`;
  const s = `0x${sigHex.slice(64, 128)}`;
  const v = parseInt(sigHex.slice(128, 130), 16);

  return {
    from: account.address,
    to,
    amount,
    valid_after: "0",
    valid_before: "0",
    nonce,
    v,
    r,
    s,
  };
}

/**
 * Get a combined 65-byte hex signature (r + s + v) for x402 v2 PaymentPayload.
 */
export function combinedSignature(auth: TransferAuthorization): string {
  const r = auth.r.startsWith("0x") ? auth.r.slice(2) : auth.r;
  const s = auth.s.startsWith("0x") ? auth.s.slice(2) : auth.s;
  return `0x${r}${s}${auth.v.toString(16).padStart(2, "0")}`;
}
