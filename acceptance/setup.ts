/**
 * Acceptance test setup — real testnet against Base Sepolia.
 *
 * Requires: PAYSKILL_TESTNET_KEY env var with a funded testnet wallet
 * (raw 64-char hex private key). Matches the CI secret naming used by
 * sdk and cli. Not to be confused with the user-facing PAYSKILL_SIGNER_KEY
 * runtime override which is overloaded (raw key OR keystore password).
 *
 * Runs: PAY_NETWORK=testnet
 */

import { Wallet } from "@pay-skill/sdk";

/** USDC floor below which we top up the test wallet. */
const TEST_BALANCE_FLOOR_USDC = 50;
/** USDC amount requested from the server's /mint endpoint when topping up. */
const TEST_MINT_AMOUNT_USDC = 100;

export function createTestWallet(): { wallet: Wallet; address: string } {
  const key = process.env.PAYSKILL_TESTNET_KEY;
  if (!key) throw new Error("PAYSKILL_TESTNET_KEY env var required for acceptance tests");
  const wallet = new Wallet({ privateKey: key, testnet: true });
  return { wallet, address: wallet.address };
}

/**
 * Top up the shared CI wallet to at least TEST_BALANCE_FLOOR_USDC.
 *
 * Server-side /api/v1/mint is rate-limited at 1 call per wallet per hour
 * (MINT_RATE_LIMIT_SECS in server/src/routes/mint.rs). CI runs reuse the
 * same wallet, so we skip the mint when the wallet already holds enough
 * from a previous run — otherwise back-to-back runs inside one hour would
 * 429 and break the suite.
 *
 * Returns the mint tx hash when a mint happened, null when skipped.
 */
export async function ensureTestBalance(wallet: Wallet): Promise<string | null> {
  const before = await wallet.balance();
  if (before.available >= TEST_BALANCE_FLOOR_USDC) {
    console.log(
      `  balance $${before.available} already >= $${TEST_BALANCE_FLOOR_USDC}, skipping mint`,
    );
    return null;
  }
  console.log(
    `  balance $${before.available} below $${TEST_BALANCE_FLOOR_USDC}, minting ${TEST_MINT_AMOUNT_USDC}...`,
  );
  const result = await wallet.mint(TEST_MINT_AMOUNT_USDC);
  await waitForBalance(wallet, TEST_BALANCE_FLOOR_USDC);
  return result.txHash;
}

/** @deprecated use ensureTestBalance — this bypasses the rate-limit guard. */
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

/**
 * True if the given error message looks like a /mint rate-limit response.
 * Used to skip the pay_mint tool test on reused CI wallets.
 */
export function isMintRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate.?limit|rate_limited|429|too many requests/i.test(msg);
}
