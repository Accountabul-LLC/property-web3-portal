import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NETWORK,
  TRADING_ENABLED,
  resolveInitialNetwork,
  isSyntheticQuote,
  canSubmitSwap,
  assertNoWalletSecret,
} from './prototypeSafety';

describe('prototype safety defaults', () => {
  it('defaults to testnet', () => {
    expect(DEFAULT_NETWORK).toBe('testnet');
  });

  it('keeps public trading disabled', () => {
    expect(TRADING_ENABLED).toBe(false);
  });
});

describe('resolveInitialNetwork', () => {
  it('keeps an explicit mainnet choice', () => {
    expect(resolveInitialNetwork('mainnet')).toBe('mainnet');
  });

  it('falls back to testnet for missing or unknown values', () => {
    expect(resolveInitialNetwork(null)).toBe('testnet');
    expect(resolveInitialNetwork(undefined)).toBe('testnet');
    expect(resolveInitialNetwork('')).toBe('testnet');
    expect(resolveInitialNetwork('devnet')).toBe('testnet');
  });
});

describe('synthetic quote guard', () => {
  it('flags locally generated quotes', () => {
    expect(isSyntheticQuote({ __synthetic: true, Account: 'r...' })).toBe(true);
    expect(isSyntheticQuote({ Account: 'r...' })).toBe(false);
    expect(isSyntheticQuote(null)).toBe(false);
  });

  it('never allows submitting a synthetic quote', () => {
    expect(canSubmitSwap({ __synthetic: true })).toBe(false);
    expect(canSubmitSwap(null)).toBe(false);
    expect(canSubmitSwap({ TransactionType: 'Payment' })).toBe(true);
  });
});

describe('assertNoWalletSecret', () => {
  it('throws when a seed would leave the browser', () => {
    expect(() => assertNoWalletSecret({ wallet_secret: 'sEd...' })).toThrow();
    expect(() => assertNoWalletSecret({ seed: 'sEd...' })).toThrow();
    expect(() => assertNoWalletSecret({ privateKey: 'abc' })).toThrow();
  });

  it('allows payloads without secrets', () => {
    expect(() => assertNoWalletSecret({ tx_json: {}, wallet_address: 'rXYZ' })).not.toThrow();
    expect(() => assertNoWalletSecret({ wallet_secret: null })).not.toThrow();
    expect(() => assertNoWalletSecret(undefined)).not.toThrow();
  });
});
