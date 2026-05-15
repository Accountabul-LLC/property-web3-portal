// Public, hardcoded list of treasury wallets shown on /treasury.
// `mockUsd` is the demo allocation displayed in the pie chart — live on-chain
// holdings still render in the wallet detail card below.
export interface TreasuryWalletConfig {
  address: string;
  label: string;
  network: 'mainnet' | 'testnet';
  purpose: string;
  description?: string;
  mockUsd: number;
}

export const TREASURY_WALLETS: TreasuryWalletConfig[] = [
  {
    address: 'rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx',
    label: 'Operating Wallet',
    network: 'testnet',
    purpose: 'Operations',
    description:
      'Primary operating treasury — funds day-to-day platform expenses, gas fees, and short-term obligations.',
    mockUsd: 1_200_000,
  },
  {
    address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    label: 'Property Reserve Wallet',
    network: 'testnet',
    purpose: 'Property Reserves',
    description:
      'Holds tokenized real-estate (MPT) reserves and rental income distributions before payout to holders.',
    mockUsd: 3_500_000,
  },
  {
    address: 'rNRiQJzLHEjt6KdCBjK4ttjTxBhrAm7vRz',
    label: 'Yield Wallet',
    network: 'testnet',
    purpose: 'Financial Yield Product',
    description:
      'Funds the yield-bearing financial product — interest accrual, lending positions, and liquidity provision.',
    mockUsd: 1_200_000,
  },
  {
    address: 'rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF',
    label: 'Rewards Wallet',
    network: 'testnet',
    purpose: 'Ecosystem Rewards',
    description:
      'Member rewards & ecosystem incentives — referrals, loyalty, and quarterly buyback distributions.',
    mockUsd: 800_000,
  },
  {
    address: 'rJb5KsHsDHF1YS5B5DU6QCkH5NsPaKQTcy',
    label: 'Cold Storage Vault',
    network: 'testnet',
    purpose: 'Long-term Reserves',
    description:
      'Long-term cold reserve — multi-sig protected, used only for strategic acquisitions and emergencies.',
    mockUsd: 500_000,
  },
];
