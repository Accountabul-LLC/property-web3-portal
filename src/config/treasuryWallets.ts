// Public, hardcoded list of treasury wallets shown on /treasury.
// `mockUsd` is the demo allocation displayed in the pie chart — live on-chain
// holdings still render in the wallet detail card below.
export interface MockTokenHolding {
  symbol: string;
  name: string;
  amount: number;
  priceUsd: number;
  logo?: string;
}

export interface TreasuryWalletConfig {
  address?: string;
  label: string;
  network: 'mainnet' | 'testnet';
  purpose: string;
  description?: string;
  mockUsd: number;
  mockTokens?: MockTokenHolding[];
  isPlaceholder?: boolean;
  setupNote?: string;
}

// Demo price for the Accountabul (ABUL) governance token
const ABUL_PRICE = 0.4732;
const ABUL_LOGO = '/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png';
const abul = (amount: number): MockTokenHolding => ({
  symbol: 'ABUL',
  name: 'Accountabul Token',
  amount,
  priceUsd: ABUL_PRICE,
  logo: ABUL_LOGO,
});

export const TREASURY_WALLETS: TreasuryWalletConfig[] = [
  {
    label: 'ABUL Token Wallet',
    network: 'testnet',
    purpose: 'Accountabul Token Reserve',
    description:
      'Dedicated treasury for the Accountabul (ABUL) governance token — long-term protocol reserve, vesting allocations, and liquidity backing.',
    mockUsd: 6_982_317.04,
    mockTokens: [abul(14_756_173.92)],
    isPlaceholder: true,
    setupNote: 'Configure the real XRPL r-address for the ABUL reserve before enabling live treasury reporting.',
  },
  {
    address: 'rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx',
    label: 'Operating Wallet',
    network: 'testnet',
    purpose: 'Operations',
    description:
      'Primary operating treasury — funds day-to-day platform expenses, gas fees, and short-term obligations.',
    mockUsd: 1_184_372.41,
    mockTokens: [abul(487_213.76)],
  },
  {
    address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    label: 'Property Reserve Wallet',
    network: 'testnet',
    purpose: 'Property Reserves',
    description:
      'Holds tokenized real-estate (MPT) reserves and rental income distributions before payout to holders.',
    mockUsd: 3_472_918.07,
    mockTokens: [abul(1_842_605.19)],
  },
  {
    address: 'rNRiQJzLHEjt6KdCBjK4ttjTxBhrAm7vRz',
    label: 'Yield Wallet',
    network: 'testnet',
    purpose: 'Financial Yield Product',
    description:
      'Funds the yield-bearing financial product — interest accrual, lending positions, and liquidity provision.',
    mockUsd: 1_213_604.88,
    mockTokens: [abul(612_489.03)],
  },
  {
    address: 'rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF',
    label: 'Rewards Wallet',
    network: 'testnet',
    purpose: 'Ecosystem Rewards',
    description:
      'Member rewards & ecosystem incentives — referrals, loyalty, and quarterly buyback distributions.',
    mockUsd: 793_146.52,
    mockTokens: [abul(358_927.44)],
  },
  {
    address: 'rE7VrsvX9EcH8TbEHK8Upie6gtQZ4tjbek',
    label: 'Trustline Sponsor Wallet',
    network: 'mainnet',
    purpose: 'User trustline subsidies',
    description:
      'Covers the 0.2 XRP reserve required for new trustlines so members can swap into any IOU token without holding extra XRP. Replenished from the Operating Wallet.',
    mockUsd: 124_500.00,
    mockTokens: [abul(82_417.55)],
  },
  {
    address: 'rJb5KsHsDHF1YS5B5DU6QCkH5NsPaKQTcy',
    label: 'Cold Storage Vault',
    network: 'testnet',
    purpose: 'Long-term Reserves',
    description:
      'Long-term cold reserve — multi-sig protected, used only for strategic acquisitions and emergencies.',
    mockUsd: 574_986.08,
    mockTokens: [abul(247_851.92)],
  },
];
