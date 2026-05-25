// Shared helpers for showing wallets in the unified UI.
// The user-facing identifier is the last 6 characters of the address
// (consistent across mainnet/testnet and across the app).

export function walletShortId(address: string | null | undefined): string {
  if (!address) return '';
  return `…${address.slice(-6)}`;
}

/** Long form: full label (custom or xaman name) + short id suffix when both exist. */
export function walletDisplayName(
  label: string | null | undefined,
  address: string | null | undefined,
): string {
  const short = walletShortId(address);
  if (label && label.trim().length > 0) return `${label} · ${short}`;
  return short;
}
