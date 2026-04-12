/**
 * Acceptance test setup — real testnet against Base Sepolia.
 *
 * Requires: PAYSKILL_SIGNER_KEY env var with a funded testnet wallet.
 * Runs: PAY_NETWORK=testnet
 */

import { Wallet } from "@pay-skill/sdk";

export function createTestWallet(): { wallet: Wallet; address: string } {
  const key = process.env.PAYSKILL_SIGNER_KEY;
  if (!key) throw new Error("PAYSKILL_SIGNER_KEY env var required for acceptance tests");
  const wallet = new Wallet({ privateKey: key, testnet: true });
  return { wallet, address: wallet.address };
}

export async function mintTestUsdc(wallet: Wallet, amount: number): Promise<string> {
  const result = await wallet.mint(amount);
  return result.txHash;
}

export async function waitForBalance(
  wallet: Wallet,
  minUsdc: number,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bal = await wallet.balance();
    if (bal.available >= minUsdc) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Balance did not reach $${minUsdc} within ${timeoutMs}ms`);
}
