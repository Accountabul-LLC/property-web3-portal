// Public, hardcoded list of treasury wallets shown on /treasury.
// Add or remove entries here to update the public transparency page.
export interface TreasuryWalletConfig {
  address: string;
  label: string;
  network: 'mainnet' | 'testnet';
  description?: string;
}

export const TREASURY_WALLETS: TreasuryWalletConfig[] = [
  {
    address: 'rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx',
    label: 'REI Wallet',
    network: 'testnet',
    description: 'Real estate investing treasury',
  },
];
