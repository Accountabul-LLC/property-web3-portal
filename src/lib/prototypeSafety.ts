/**
 * Safety-critical constants and guards for the hackathon prototype build.
 *
 * These are intentionally small, pure helpers so they can be unit tested and
 * reviewed quickly. They encode four rules:
 *
 * 1. Public trading surfaces (buy, sell, order placement, property swaps) are
 *    not functional and must render as disabled controls.
 * 2. No synthetic / fake transaction hashes are ever produced.
 * 3. Testnet is the default XRPL network for public flows.
 * 4. No wallet secret is ever transmitted from the browser.
 */

export type PrototypeNetwork = 'mainnet' | 'testnet';

/** Testnet is the safe default for every public wallet flow. */
export const DEFAULT_NETWORK: PrototypeNetwork = 'testnet';

/** Public trading controls are prototype-only and stay disabled. */
export const TRADING_ENABLED = false;

/** Standard label for a control that exists visually but does nothing yet. */
export const PROTOTYPE_DISABLED_LABEL = 'Prototype / coming later';

/**
 * Resolve the initial network from a persisted value.
 * Anything unrecognised (including a missing value) falls back to testnet.
 */
export function resolveInitialNetwork(saved: string | null | undefined): PrototypeNetwork {
  return saved === 'mainnet' ? 'mainnet' : DEFAULT_NETWORK;
}

/**
 * A quote object that was produced locally rather than by the XRPL path finder.
 * Synthetic quotes can be displayed as estimates but must never be submitted.
 */
export function isSyntheticQuote(txJson: unknown): boolean {
  return Boolean(txJson && typeof txJson === 'object' && (txJson as Record<string, unknown>).__synthetic);
}

/**
 * Guard used before any submission path. Synthetic quotes are never executable
 * and mainnet submissions require an explicit confirmation upstream.
 */
export function canSubmitSwap(txJson: unknown): boolean {
  return Boolean(txJson) && !isSyntheticQuote(txJson);
}

/**
 * Defensive check: no request body leaving the browser may carry a wallet
 * secret / seed. Throws so the caller fails loudly in development and tests.
 */
export function assertNoWalletSecret(payload: unknown, context = 'request'): void {
  if (!payload || typeof payload !== 'object') return;
  const forbidden = ['wallet_secret', 'secret', 'seed', 'private_key', 'privateKey'];
  for (const key of Object.keys(payload as Record<string, unknown>)) {
    if (forbidden.includes(key) && (payload as Record<string, unknown>)[key]) {
      throw new Error(`Refusing to send a wallet secret in ${context}. Signing must happen in Xaman.`);
    }
  }
}
