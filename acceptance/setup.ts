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

/** USDC amount requested from the server's /mint endpoint at startup. */
const TEST_MINT_AMOUNT_USDC = 100;

export function createTestWallet(): { wallet: Wallet; address: string } {
  const key = process.env.PAYSKILL_TESTNET_KEY;
  if (!key) throw new Error("PAYSKILL_TESTNET_KEY env var required for acceptance tests");
  const wallet = new Wallet({ privateKey: key, testnet: true });
  return { wallet, address: wallet.address };
}

/**
 * Fund the shared CI wallet at startup.
 *
 * Calls wallet.mint() once. The server's /api/v1/mint endpoint submits
 * USDC.mint on-chain via the relayer and awaits confirmation (see
 * server/src/chain/chain_client.rs send_call_and_wait), so when this
 * Promise resolves the tx IS mined and the balance IS on-chain.
 *
 * Two guards:
 *   - Server-side /mint is rate-limited 1/wallet/hour (MINT_RATE_LIMIT_SECS
 *     in server/src/routes/mint.rs). Back-to-back CI runs on the same
 *     wallet will 429 — that means the previous run already funded the
 *     wallet, so we swallow the rate-limit error and proceed.
 *   - We deliberately do NOT verify balance via wallet.balance() after
 *     minting. The published SDK (0.2.3 at time of writing) has a latent
 *     bug in both TS and Python balance() methods: they divide the
 *     server's dollar-formatted "100.00" string by 1_000_000, reporting
 *     0.0001 instead of 100. Server truth is on-chain and the mint
 *     await already proves confirmation.
 *
 * Returns the mint tx hash on success, null on a rate-limit skip.
 */
export async function ensureTestBalance(wallet: Wallet): Promise<string | null> {
  try {
    const result = await wallet.mint(TEST_MINT_AMOUNT_USDC);
    return result.txHash;
  } catch (err) {
    if (isMintRateLimitError(err)) {
      console.log(
        `  mint rate-limited — wallet funded by a previous run in the last hour, proceeding`,
      );
      return null;
    }
    throw err;
  }
}

/**
 * True if the given error message looks like a /mint rate-limit response.
 * Used to skip the pay_mint tool test on reused CI wallets and to
 * tolerate rate-limit errors in the startup fund step.
 */
export function isMintRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate.?limit|rate_limited|429|too many requests/i.test(msg);
}
