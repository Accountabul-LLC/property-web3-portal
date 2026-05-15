// Public, hardcoded list of treasury wallets shown on /treasury.
// Add or remove entries here to update the public transparency page.
export interface TreasuryWalletConfig {
  address: string;
  label: string;
  network: 'mainnet' | 'testnet';
  purpose: string;
  description?: string;
}

export const TREASURY_WALLETS: TreasuryWalletConfig[] = [
  {
    address: 'rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx',
    label: 'REI Operating Wallet',
    network: 'testnet',
    purpose: 'Operations',
    description:
      'Primary operating treasury — funds day-to-day platform expenses, gas fees, and short-term obligations.',
  },
  {
    address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    label: 'Property Reserve Wallet',
    network: 'testnet',
    purpose: 'Property Reserves',
    description:
      'Holds tokenized real-estate (MPT) reserves and rental income distributions before payout to holders.',
  },
  {
    address: 'rNRiQJzLHEjt6KdCBjK4ttjTxBhrAm7vRz',
    label: 'Yield & Rewards Wallet',
    network: 'testnet',
    purpose: 'Member Rewards',
    description:
      'Funds member rewards, staking yield, and quarterly buyback distributions.',
  },
  {
    address: 'rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF',
    label: 'Cold Storage Vault',
    network: 'testnet',
    purpose: 'Long-term Reserves',
    description:
      'Long-term cold reserve — multi-sig protected, used only for strategic acquisitions and emergencies.',
  },
];
