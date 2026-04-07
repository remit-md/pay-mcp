/**
 * EIP-712 authentication for Pay API requests.
 *
 * Every authenticated request includes four headers:
 *   X-Pay-Agent     — wallet address (0x-prefixed, checksummed)
 *   X-Pay-Signature — EIP-712 signature (0x-prefixed hex, 65 bytes)
 *   X-Pay-Timestamp — unix timestamp in seconds
 *   X-Pay-Nonce     — random 32-byte hex (0x-prefixed)
 *
 * Domain: { name: "pay", version: "0.1", chainId, verifyingContract: routerAddress }
 * Type: APIRequest(string method, string path, uint256 timestamp, bytes32 nonce)
 *
 * Port of sdk/typescript/src/auth.ts — identical signatures.
 */

import { type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

export interface AuthConfig {
  chainId: number;
  routerAddress: Address;
}

export interface AuthHeaders {
  "X-Pay-Agent": string;
  "X-Pay-Signature": string;
  "X-Pay-Timestamp": string;
  "X-Pay-Nonce": string;
}

const EIP712_DOMAIN = {
  name: "pay",
  version: "0.1",
} as const;

const API_REQUEST_TYPES = {
  APIRequest: [
    { name: "method", type: "string" },
    { name: "path", type: "string" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Build auth headers for an API request using a private key.
 */
export async function buildAuthHeaders(
  privateKey: Hex,
  method: string,
  path: string,
  config: AuthConfig,
): Promise<AuthHeaders> {
  const account = privateKeyToAccount(privateKey);
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const nonce = ("0x" + randomBytes(32).toString("hex")) as Hex;

  const signature = await account.signTypedData({
    domain: {
      ...EIP712_DOMAIN,
      chainId: config.chainId,
      verifyingContract: config.routerAddress,
    },
    types: API_REQUEST_TYPES,
    primaryType: "APIRequest",
    message: {
      method: method.toUpperCase(),
      path,
      timestamp,
      nonce,
    },
  });

  return {
    "X-Pay-Agent": account.address,
    "X-Pay-Signature": signature,
    "X-Pay-Timestamp": timestamp.toString(),
    "X-Pay-Nonce": nonce,
  };
}
