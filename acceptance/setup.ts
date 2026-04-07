/**
 * Acceptance test setup — real testnet against Base Sepolia.
 *
 * Requires: PAYSKILL_SIGNER_KEY env var with a funded testnet wallet.
 * Runs: PAY_NETWORK=testnet
 */

import { PayAPI } from "../src/api.js";
import { privateKeyToAddress } from "../src/crypto/address.js";
import type { Hex } from "viem";

const API_URL = "https://testnet.pay-skill.com/api/v1";
const CHAIN_ID = 84532;

export function getTestKey(): Hex {
  const raw = process.env.PAYSKILL_SIGNER_KEY;
  if (!raw) throw new Error("PAYSKILL_SIGNER_KEY env var required for acceptance tests");
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("Invalid private key format");
  return `0x${hex}` as Hex;
}

export function createTestApi(): { api: PayAPI; privateKey: Hex; address: string } {
  const privateKey = getTestKey();
  const address = privateKeyToAddress(privateKey.slice(2));
  const api = new PayAPI(privateKey, address, API_URL, CHAIN_ID);
  return { api, privateKey, address };
}

export async function mintTestUsdc(api: PayAPI, amount: number): Promise<string> {
  const result = await api.post<{ tx_hash: string }>("/mint", {
    amount: amount * 1_000_000,
    to: api.getAddress(),
  });
  return result.tx_hash;
}

export async function waitForBalance(
  api: PayAPI,
  minUsdc: number,
  timeoutMs = 30_000,
): Promise<void> {
  const minMicro = minUsdc * 1_000_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await api.get<{ available_usdc: string }>("/status");
    if (Number(status.available_usdc) >= minMicro) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Balance did not reach $${minUsdc} within ${timeoutMs}ms`);
}
