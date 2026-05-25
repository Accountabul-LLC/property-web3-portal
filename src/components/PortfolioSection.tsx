import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, PieChart, ArrowUpDown, ArrowDownLeft, ArrowUpRight, Loader2, Coins, ExternalLink, QrCode, Send, Repeat, Settings, ShieldCheck, Globe, Users, BarChart3, ChevronDown, ChevronUp, Info, RefreshCw, DollarSign, Clock, FlaskConical, Droplets, Gem, Copy, Check } from 'lucide-react';
import { useXRPLPortfolio, type MPTIssuance, type MPTHolding } from '@/hooks/useXRPLPortfolio';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useXRPLSubscription } from '@/hooks/useXRPLSubscription';
import { useTokenMeta } from '@/hooks/useTokenMeta';
import { valueMptIssuance, sumMptIssuerUsd } from '@/lib/mptValuation';
import ReceiveModal from '@/components/ReceiveModal';
import SendModal from '@/components/SendModal';
import NetworkToggle from '@/components/NetworkToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Renders a token logo from Bithomp CDN with fallback to Coins icon */
const TokenAvatar = ({ issuer, currency, size = 10 }: { issuer?: string; currency?: string; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 12 ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = size === 12 ? 'w-6 h-6' : 'w-5 h-5';

  const isXRP = !issuer || currency === 'XRP';

  // Bithomp CDN: https://cdn.bithomp.com/issued-token/{issuer}/{currency}
  // For XRP native: use a known XRP icon
  const imgUrl = isXRP
    ? 'https://cdn.bithomp.com/xrp.svg'
    : `https://cdn.bithomp.com/issued-token/${issuer}/${currency}`;

  if (failed) {
    return (
      <div className={`${sizeClass} bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0`}>
        <Coins className={`${iconSize} text-primary`} />
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={currency || 'Token'}
      className={`${sizeClass} rounded-full flex-shrink-0 object-cover bg-muted`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

interface PortfolioSectionProps {
  overrideAddress?: string | null;
  isReadOnly?: boolean;
  focusTxHash?: string | null;
}

const PortfolioSection = ({ overrideAddress, isReadOnly = false, focusTxHash = null }: PortfolioSectionProps) => {
  const queryClient = useQueryClient();
  const { wallets, activeAddress, activeWallet, isConnected, activeNetwork } = useActiveWallet();
  const displayAddress = overrideAddress || activeAddress;
  const hasWallet = overrideAddress ? !!overrideAddress : isConnected;
  const overrideWallet = overrideAddress ? wallets.find((wallet) => wallet.address === overrideAddress) ?? null : null;
  const resolvedNetwork = overrideWallet?.network ?? activeWallet?.network ?? activeNetwork;
  const network: 'mainnet' | 'testnet' = resolvedNetwork === 'testnet' ? 'testnet' : 'mainnet';
  const isTestnet = network === 'testnet';
  const { data: xrplData, isLoading, error, dataUpdatedAt, isFetching } = useXRPLPortfolio(displayAddress, network);
  const [isFunding, setIsFunding] = useState(false);

  const explorerBase = network === 'testnet' ? 'https://testnet.xrpl.org' : 'https://livenet.xrpl.org';

  const handleFaucetFund = async () => {
    if (!displayAddress) return;
    setIsFunding(true);
    try {
      const { data, error } = await supabase.functions.invoke('xrpl-testnet-faucet', {
        body: { destination: displayAddress },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Faucet failed');
      toast.success(`Funded! Balance: ${data.balance} XRP`);
      queryClient.invalidateQueries({ queryKey: ['xrpl_portfolio', displayAddress, network] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Faucet error: ${message}`);
    } finally {
      setIsFunding(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['xrpl_portfolio', displayAddress, network] });
    queryClient.invalidateQueries({ queryKey: ['token_meta'] });
  };
  useXRPLSubscription(displayAddress, network);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [mptSortMode, setMptSortMode] = useState<'newest' | 'alpha' | 'supply'>('newest');
  const [mptSearchQuery, setMptSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const focusedTxRef = useRef<HTMLAnchorElement | null>(null);

  // Scroll to and briefly highlight a transaction when opened via notification
  useEffect(() => {
    if (!focusTxHash || !xrplData) return;
    const t = setTimeout(() => {
      focusedTxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(t);
  }, [focusTxHash, xrplData]);

  const handleCopyAddress = async () => {
    if (!displayAddress) return;
    try {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Address copied to clipboard');
    } catch {
      toast.error('Failed to copy address');
    }
  };

  // Fetch enriched metadata for all token holdings
  const { data: tokenMetaData } = useTokenMeta(
    xrplData?.token_holdings.map((t) => ({ currency: t.currency, issuer: t.issuer }))
  );
  const tokenMetaMap = tokenMetaData?.tokenMap;
  const xrpUsdPrice = tokenMetaData?.xrpUsd ?? 0;

  // Compute total wallet USD value
  const portfolioValuation = useMemo(() => {
    if (!xrplData) return null;

    const hasXrpPrice = xrpUsdPrice > 0;
    const xrpSubtotal = hasXrpPrice ? (xrplData.xrp_balance ?? 0) * xrpUsdPrice : null;
    let tokenSubtotal = 0;
    let pricedCount = 0;
    let unpricedCount = 0;

    const assetValues: Array<{ key: string; subtotalUsd: number | null; priceUsd: number | null; priceSource: string }> = [];

    // XRP
    assetValues.push({
      key: 'XRP_NATIVE',
      subtotalUsd: xrpSubtotal,
      priceUsd: hasXrpPrice ? xrpUsdPrice : null,
      priceSource: hasXrpPrice ? 'market' : 'unavailable',
    });
    if (hasXrpPrice) pricedCount++; else unpricedCount++;

    for (const token of xrplData.token_holdings) {
      const meta = tokenMetaMap?.get(`${token.currency}:${token.issuer}`);
      if (meta?.price && meta.price > 0) {
        const sub = Number(token.balance) * meta.price;
        tokenSubtotal += sub;
        pricedCount++;
        assetValues.push({
          key: `${token.currency}:${token.issuer}`,
          subtotalUsd: sub,
          priceUsd: meta.price,
          priceSource: 'market',
        });
      } else {
        unpricedCount++;
        assetValues.push({
          key: `${token.currency}:${token.issuer}`,
          subtotalUsd: null,
          priceUsd: null,
          priceSource: 'unavailable',
        });
      }
    }

    const hasUsdValuation = hasXrpPrice && unpricedCount === 0;

    // MPT issuer-held value (unsold supply * implied price per token)
    let mptSubtotal = 0;
    for (const mpt of xrplData.mpt_issuances || []) {
      const v = valueMptIssuance(mpt);
      if (v.issuerHeldUsd && v.issuerHeldUsd > 0) {
        mptSubtotal += v.issuerHeldUsd;
        pricedCount++;
      } else if ((mpt.max_amount && Number(mpt.max_amount) > 0)) {
        unpricedCount++;
      }
    }

    const totalUsd = hasUsdValuation ? ((xrpSubtotal ?? 0) + tokenSubtotal + mptSubtotal) : null;

    return {
      totalUsd,
      xrpSubtotal,
      tokenSubtotal,
      mptSubtotal,
      pricedCount,
      unpricedCount,
      hasUsdValuation,
      assetValues,
    };
  }, [xrplData, xrpUsdPrice, tokenMetaMap]);

  // "Updated X ago" helper
  const updatedAgo = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const diff = Math.round((Date.now() - dataUpdatedAt) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  }, [dataUpdatedAt]);

  const formatXRP = (amount: number | undefined | null) => (amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const shortenAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const decodeCurrency = (hex: string) => {
    if (hex.length <= 3) return hex;
    try {
      const decoded = hex.replace(/0+$/, '').replace(/../g, (m: string) => String.fromCharCode(parseInt(m, 16)));
      return decoded || hex;
    } catch { return hex; }
  };

  if (!hasWallet) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <Wallet className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-semibold mb-4">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Connect your wallet to view your portfolio holdings and transaction history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-x-4 gap-y-2">
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Your XRPL Portfolio
          </h2>
          <NetworkToggle />
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{isReadOnly ? 'Viewing' : 'Live'}</span>
            {!isReadOnly && activeWallet?.xamanName && (
              <span className="font-semibold text-foreground">{activeWallet.xamanName}</span>
            )}
            {!isReadOnly && activeWallet?.label && activeWallet.label !== activeWallet.xamanName && (
              <span className="text-foreground">· {activeWallet.label}</span>
            )}
            <div className="flex items-center gap-1.5">
              <a
                href={`${explorerBase}/accounts/${displayAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {shortenAddress(displayAddress || '')}
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={handleCopyAddress}
                className="inline-flex items-center justify-center p-1 rounded hover:bg-muted transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => setIsSendOpen(true)} size="sm" className="gap-2">
              <Send className="w-4 h-4" /> Send
            </Button>
            <Button onClick={() => setIsReceiveOpen(true)} size="sm" variant="outline" className="gap-2">
              <QrCode className="w-4 h-4" /> Receive
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <p className="text-destructive font-medium mb-2">Failed to load wallet data</p>
          <p className="text-muted-foreground text-sm">{(error as Error).message}</p>
        </Card>
      ) : xrplData ? (
        <>
          {/* Total Wallet Value Header */}
          {portfolioValuation && (
            <Card className={`p-6 mb-8 bg-gradient-card ${isTestnet ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/10'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Account Worth</p>
                    {isTestnet && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                        <FlaskConical className="w-3 h-3" />
                        Testnet
                      </Badge>
                    )}
                  </div>
                  <p className="text-4xl font-bold tracking-tight">
                    {portfolioValuation.totalUsd !== null
                      ? `$${portfolioValuation.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'USD unavailable'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {updatedAgo || 'now'}
                    </span>
                    {portfolioValuation.totalUsd === null ? (
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Live USD pricing unavailable
                      </span>
                    ) : portfolioValuation.unpricedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {portfolioValuation.unpricedCount} asset{portfolioValuation.unpricedCount > 1 ? 's' : ''} without USD price
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isTestnet && !isReadOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFaucetFund}
                      disabled={isFunding}
                      className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      {isFunding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Droplets className="w-3.5 h-3.5" />}
                      Fund with Faucet
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Worth</p>
                  <p className="text-2xl font-bold">
                    {portfolioValuation?.totalUsd !== null && portfolioValuation?.totalUsd !== undefined
                      ? `$${portfolioValuation.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Unavailable'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {portfolioValuation?.hasUsdValuation ? 'USD estimated' : 'Live price unavailable'}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                  <PieChart className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Token Holdings</p>
                  <p className="text-2xl font-bold">{xrplData.token_holdings.length + 1 + (xrplData.mpt_issuances?.length || 0) + (xrplData.mpt_holdings?.length || 0)}</p>
                  {portfolioValuation && portfolioValuation.pricedCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {portfolioValuation.pricedCount} priced
                    </p>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
                  <ArrowUpDown className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recent Transactions</p>
                  <p className="text-2xl font-bold">{xrplData.transactions.length}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Token Holdings */}
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold mb-6">Token Holdings</h3>
              <div className="space-y-4">
                {/* XRP as first holding */}
                {(() => {
                  const isXrpExpanded = expandedToken === 'XRP_NATIVE';
                  return (
                    <Card
                      className={`hover:shadow-card transition-all duration-300 border-primary/20 cursor-pointer ${isXrpExpanded ? 'ring-1 ring-primary/30' : ''}`}
                      onClick={() => setExpandedToken(isXrpExpanded ? null : 'XRP_NATIVE')}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <TokenAvatar currency="XRP" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-lg">XRP</p>
                                <a
                                  href="https://xrpl.org/about/xrp"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="Learn about XRP"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </a>
                              </div>
                              <p className="text-xs text-muted-foreground">Native token · XRP Ledger</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                                <p className="text-lg font-bold">{formatXRP(xrplData.xrp_balance)} <span className="text-xs font-normal text-muted-foreground">XRP</span></p>
                              </div>
                              {xrpUsdPrice > 0 ? (
                                <div className="mt-1 border-t border-border/50 pt-1">
                                  <div className="flex items-center justify-end gap-1">
                                    <DollarSign className="w-3 h-3 text-primary" />
                                    <p className="text-sm font-semibold text-primary">
                                      {((xrplData.xrp_balance ?? 0) * xrpUsdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    @ ${xrpUsdPrice.toFixed(4)}/XRP
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">No USD price</p>
                              )}
                            </div>
                            {isXrpExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {isXrpExpanded && (
                        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                          <p className="text-sm text-muted-foreground">
                            XRP is the native digital asset of the XRP Ledger — a decentralized, open-source blockchain. It's used for fast, low-cost cross-border payments and serves as the bridge currency on the XRPL DEX.
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {xrpUsdPrice > 0 && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Price</p>
                                <p className="text-sm font-bold">${xrpUsdPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                              </div>
                            )}
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-[10px] uppercase text-muted-foreground font-medium">Balance</p>
                              <p className="text-sm font-bold">{formatXRP(xrplData.xrp_balance)} XRP</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-[10px] uppercase text-muted-foreground font-medium">Reserve</p>
                              <p className="text-sm font-bold">{formatXRP(xrplData.reserve_xrp)} XRP</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-[10px] uppercase text-muted-foreground font-medium">Spendable</p>
                              <p className="text-sm font-bold">{formatXRP(xrplData.spendable_xrp)} XRP</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <a
                              href="https://xrpl.org/about/xrp"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              About XRP
                            </a>
                            <a
                              href={`${explorerBase}/accounts/${displayAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              XRPL Explorer
                            </a>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })()}
                {/* Issued tokens */}
                {xrplData.token_holdings.map((token, idx) => {
                  const meta = tokenMetaMap?.get(`${token.currency}:${token.issuer}`);
                  const displayName = meta?.name || decodeCurrency(token.currency);
                  const issuerLabel = meta?.issuer_name || shortenAddress(token.issuer);
                  const tokenKey = `${token.currency}-${token.issuer}`;
                  const isExpanded = expandedToken === tokenKey;
                  const explorerUrl = `${explorerBase}/token/${token.currency}.${token.issuer}`;
                  const websiteUrl = meta?.website
                    ? (meta.website.startsWith('http') ? meta.website : `https://${meta.website}`)
                    : null;

                  return (
                    <Card
                      key={`${tokenKey}-${idx}`}
                      className={`hover:shadow-card transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}
                      onClick={() => setExpandedToken(isExpanded ? null : tokenKey)}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <TokenAvatar issuer={token.issuer} currency={token.currency} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-lg">{displayName}</p>
                                {meta?.trust_level != null && meta.trust_level >= 2 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Verified</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {issuerLabel}
                                {meta?.domain && ` · ${meta.domain}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                                <p className="text-lg font-bold">{Number(token.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} <span className="text-xs font-normal text-muted-foreground">{decodeCurrency(token.currency)}</span></p>
                              </div>
                              {meta?.price ? (
                                <div className="mt-1 border-t border-border/50 pt-1">
                                  <div className="flex items-center justify-end gap-1">
                                    <DollarSign className="w-3 h-3 text-primary" />
                                    <p className="text-sm font-semibold text-primary">
                                      {(Number(token.balance) * meta.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    @ ${meta.price < 0.01 ? meta.price.toExponential(2) : meta.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}/{decodeCurrency(token.currency)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">No USD price</p>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                          {meta?.description && (
                            <p className="text-sm text-muted-foreground">{meta.description}</p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {meta?.price != null && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Price</p>
                                <p className="text-sm font-bold">${meta.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                              </div>
                            )}
                            {meta?.market_cap != null && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Market Cap</p>
                                <p className="text-sm font-bold">${(meta.market_cap / 1e6).toFixed(1)}M</p>
                              </div>
                            )}
                            {meta?.holders != null && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Holders</p>
                                <p className="text-sm font-bold">{meta.holders.toLocaleString()}</p>
                              </div>
                            )}
                            {meta?.supply != null && (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Supply</p>
                                <p className="text-sm font-bold">{(meta.supply / 1e6).toFixed(1)}M</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono min-w-0">
                            <span className="flex-shrink-0">Issuer:</span>
                            <span className="truncate">{token.issuer}</span>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              XRPL Explorer
                            </a>
                            {websiteUrl && (
                              <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                {meta?.domain || 'Website'}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* MPT Issuances — tokens this wallet created */}
                {xrplData.mpt_issuances && xrplData.mpt_issuances.length > 0 && (() => {
                  const filtered = xrplData.mpt_issuances.filter(mpt => {
                    if (!mptSearchQuery) return true;
                    const q = mptSearchQuery.toLowerCase();
                    return (mpt.name || '').toLowerCase().includes(q) ||
                           (mpt.ticker || '').toLowerCase().includes(q) ||
                           (mpt.description || '').toLowerCase().includes(q) ||
                           (mpt.issuer_name || '').toLowerCase().includes(q) ||
                           (mpt.collection?.name || '').toLowerCase().includes(q) ||
                           (mpt.mpt_issuance_id || '').toLowerCase().includes(q);
                  });
                  const sorted = [...filtered].sort((a, b) => {
                    if (mptSortMode === 'alpha') return (a.name || '').localeCompare(b.name || '');
                    if (mptSortMode === 'supply') return (Number(b.max_amount || 0)) - (Number(a.max_amount || 0));
                    // newest: higher issuance ID = newer
                    return (b.mpt_issuance_id || '').localeCompare(a.mpt_issuance_id || '');
                  });
                  return (
                  <>
                    <div className="mt-8 mb-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Gem className="w-5 h-5 text-primary" />
                          MPT Issuances
                          <Badge variant="secondary" className="text-xs">{xrplData.mpt_issuances.length}</Badge>
                        </h4>
                        <div className="flex items-center gap-1">
                          {(['newest', 'alpha', 'supply'] as const).map((mode) => (
                            <Button
                              key={mode}
                              variant={mptSortMode === mode ? 'default' : 'ghost'}
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => setMptSortMode(mode)}
                            >
                              {mode === 'newest' ? 'Newest' : mode === 'alpha' ? 'A–Z' : 'Supply'}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {xrplData.mpt_issuances.length > 3 && (
                        <input
                          type="text"
                          placeholder="Search issuances..."
                          value={mptSearchQuery}
                          onChange={(e) => setMptSearchQuery(e.target.value)}
                          className="w-full h-8 px-3 text-sm rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                    </div>
                    {sorted.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">No issuances match your search.</p>
                    )}
                    {sorted.map((mpt, idx) => {
                      const mptKey = `mpt-issuance-${mpt.mpt_issuance_id || idx}`;
                      const isExpanded = expandedToken === mptKey;
                      const scale = mpt.asset_scale || 0;
                      const outstanding = mpt.outstanding_amount ? Number(mpt.outstanding_amount) / Math.pow(10, scale) : 0;
                      const maxAmt = mpt.max_amount ? Number(mpt.max_amount) / Math.pow(10, scale) : null;
                      const valuation = valueMptIssuance(mpt);

                      return (
                        <Card
                          key={mptKey}
                          className={`hover:shadow-card hover:border-primary/40 transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}
                          onClick={() => setExpandedToken(isExpanded ? null : mptKey)}
                        >
                          <div className="p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-primary/10">
                                  {mpt.image ? (
                                    <img src={mpt.image} alt={mpt.name || 'MPT'} className="w-full h-full object-cover" />
                                  ) : (
                                    <Gem className="w-5 h-5 text-primary" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-lg">{mpt.name || 'MPT Token'}</p>
                                    {mpt.ticker && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30">{mpt.ticker}</Badge>
                                    )}
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Issuer</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {mpt.issuer_name ? `${mpt.issuer_name} · ` : ''}Multi-Purpose Token
                                    {mpt.description && ` · ${mpt.description.slice(0, 40)}${mpt.description.length > 40 ? '…' : ''}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  {valuation.issuerHeldUsd != null ? (
                                    <>
                                      <p className="text-lg font-bold">
                                        ${valuation.issuerHeldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {valuation.issuerHeldUnits.toLocaleString(undefined, { maximumFractionDigits: scale })} held
                                        {valuation.pricePerTokenUsd ? ` · $${valuation.pricePerTokenUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}/tok` : ''}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-lg font-bold">{maxAmt !== null ? maxAmt.toLocaleString() : outstanding.toLocaleString(undefined, { maximumFractionDigits: scale })}</p>
                                      <p className="text-xs text-muted-foreground">supply</p>
                                    </>
                                  )}
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                              {mpt.description && (
                                <p className="text-sm text-muted-foreground">{mpt.description}</p>
                              )}

                              {/* Image & Issuer Info */}
                              {(mpt.image || mpt.issuer_name || mpt.asset_class) && (
                                <div className="flex items-start gap-4">
                                  {mpt.image && (
                                    <img
                                      src={mpt.image}
                                      alt={mpt.name || 'MPT'}
                                      className="w-20 h-20 rounded-lg object-cover bg-muted flex-shrink-0"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  <div className="space-y-1">
                                    {mpt.issuer_name && (
                                      <p className="text-xs text-muted-foreground">Issuer: <span className="text-foreground font-medium">{mpt.issuer_name}</span></p>
                                    )}
                                    {mpt.collection && mpt.collection.name && (
                                      <p className="text-xs text-muted-foreground">Class: <span className="text-foreground font-medium">{mpt.collection.name}</span></p>
                                    )}
                                    {mpt.collection && mpt.collection.family && (
                                      <p className="text-xs text-muted-foreground">Type: <span className="text-foreground font-medium">{mpt.collection.family}</span></p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Attributes */}
                              {mpt.attributes && mpt.attributes.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground font-medium mb-2">Property Details</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {mpt.attributes.map((attr, attrIdx) => (
                                      <div key={attrIdx} className="bg-muted/50 rounded-lg p-2.5">
                                        <p className="text-[10px] uppercase text-muted-foreground font-medium">{attr.trait_type}</p>
                                        <p className="text-sm font-semibold truncate">{typeof attr.value === 'number' ? attr.value.toLocaleString() : attr.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Verification URIs */}
                              {mpt.uris && mpt.uris.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground font-medium mb-2">Verification Links</p>
                                  <div className="flex flex-wrap gap-2">
                                    {mpt.uris.map((uri, uriIdx: number) => {
                                      // Support both XLS-89 object format {u, c, t} and plain string URIs
                                      const href = typeof uri === 'string' ? uri : (uri && typeof uri === 'object' && 'u' in uri ? String(uri.u || '') : '');
                                      const label = typeof uri === 'string'
                                        ? uri.replace(/^https?:\/\//, '').slice(0, 30)
                                        : (uri && typeof uri === 'object' && 't' in uri && uri.t ? String(uri.t) : href.replace(/^https?:\/\//, '').slice(0, 30));
                                      const fullUrl = href.startsWith('http') ? href : `https://${href}`;
                                      if (!href) return null;
                                      return (
                                        <a
                                          key={uriIdx}
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/5 px-2.5 py-1.5 rounded-md"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          {label}{typeof label === 'string' && label.length > 30 ? '…' : ''}
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Supply</p>
                                  <p className="text-sm font-bold">{maxAmt !== null ? maxAmt.toLocaleString() : outstanding.toLocaleString()}</p>
                                </div>
                                {maxAmt !== null && (
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Max Supply</p>
                                    <p className="text-sm font-bold">{maxAmt.toLocaleString()}</p>
                                  </div>
                                )}
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Asset Scale</p>
                                  <p className="text-sm font-bold">{scale}</p>
                                </div>
                                {mpt.transfer_fee > 0 && (
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Transfer Fee</p>
                                    <p className="text-sm font-bold">{(mpt.transfer_fee / 1000).toFixed(2)}%</p>
                                  </div>
                                )}
                              </div>
                              {mpt.mpt_issuance_id && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono break-all">
                                    <span>Issuance ID:</span>
                                    <span>{mpt.mpt_issuance_id}</span>
                                  </div>
                                  <a
                                    href={`https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/mpt/${mpt.mpt_issuance_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-md flex-shrink-0"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View in Explorer
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </>
                  );
                })()}

                {/* MPT Holdings — tokens this wallet holds (not issued) */}
                {xrplData.mpt_holdings && xrplData.mpt_holdings.length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold mt-8 mb-3 flex items-center gap-2">
                      <Gem className="w-5 h-5 text-primary" />
                      MPT Holdings
                      <Badge variant="secondary" className="text-xs">{xrplData.mpt_holdings.length}</Badge>
                    </h4>
                    {xrplData.mpt_holdings.map((mpt, idx) => {
                      const mptKey = `mpt-holding-${mpt.mpt_issuance_id || idx}`;
                      const isExpanded = expandedToken === mptKey;

                      return (
                        <Card
                          key={mptKey}
                          className={`hover:shadow-card hover:border-primary/40 transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}
                          onClick={() => setExpandedToken(isExpanded ? null : mptKey)}
                        >
                          <div className="p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Gem className="w-5 h-5 text-accent-foreground" />
                                </div>
                                <div>
                                  <p className="font-semibold text-lg">MPT</p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {mpt.mpt_issuance_id ? `${mpt.mpt_issuance_id.slice(0, 8)}…${mpt.mpt_issuance_id.slice(-6)}` : 'Unknown'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-lg font-bold">{Number(mpt.amount).toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">tokens</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
                              {mpt.mpt_issuance_id && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono break-all">
                                    <span>Issuance ID:</span>
                                    <span>{mpt.mpt_issuance_id}</span>
                                  </div>
                                  <a
                                    href={`https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/mpt/${mpt.mpt_issuance_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-md flex-shrink-0"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View in Explorer
                                  </a>
                                </div>
                              )}
                              {mpt.locked_amount && Number(mpt.locked_amount) > 0 && (
                                <div className="bg-muted/50 rounded-lg p-3 inline-block">
                                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Locked</p>
                                  <p className="text-sm font-bold">{Number(mpt.locked_amount).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Recent Transactions</h3>
              <Card className="p-6">
                {xrplData.transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions found</p>
                ) : (
                  <div className="space-y-1">
                    {xrplData.transactions.map((tx) => {
                      const txIcon = tx.is_swap ? (
                        <Repeat className="w-4 h-4 text-accent-foreground" />
                      ) : tx.type === 'TrustSet' || tx.type === 'AccountSet' ? (
                        <Settings className="w-4 h-4 text-muted-foreground" />
                      ) : tx.direction === 'received' ? (
                        <ArrowDownLeft className="w-4 h-4 text-primary" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-destructive" />
                      );

                      const txLabel = tx.is_swap
                        ? 'Swap'
                        : tx.type === 'OfferCreate'
                        ? 'DEX Order'
                        : tx.type;

                      // Show swap details
                      let amountLine = '';
                      if (tx.is_swap && tx.taker_gets && tx.taker_pays) {
                        const getCur = tx.taker_gets.currency.length > 3
                          ? decodeCurrency(tx.taker_gets.currency)
                          : tx.taker_gets.currency;
                        const payCur = tx.taker_pays.currency.length > 3
                          ? decodeCurrency(tx.taker_pays.currency)
                          : tx.taker_pays.currency;
                        amountLine = `${tx.taker_gets.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${getCur} → ${tx.taker_pays.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${payCur}`;
                      } else if (tx.delivered_amount !== null && tx.delivered_amount !== undefined) {
                        amountLine = `${formatXRP(tx.delivered_amount)} ${decodeCurrency(tx.delivered_currency || tx.currency)}`;
                      } else if (tx.amount > 0) {
                        amountLine = `${formatXRP(tx.amount)} ${decodeCurrency(tx.currency)}`;
                      }

                      const counterparty = tx.direction === 'received' ? tx.sender : tx.destination;

                      const isFocused = !!focusTxHash && tx.hash === focusTxHash;
                      return (
                        <a
                          key={tx.hash}
                          ref={isFocused ? focusedTxRef : undefined}
                          href={`https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/transactions/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-start space-x-3 py-3 px-3 -mx-3 rounded-lg border-b border-border last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-secondary/15 hover:border-secondary/30 group ${
                            isFocused ? 'bg-primary/10 ring-2 ring-primary/40 animate-pulse-once' : ''
                          }`}
                        >
                          <div className="relative flex-shrink-0 mt-0.5">
                            <TokenAvatar
                              issuer={tx.is_swap ? tx.taker_gets?.issuer : (tx.issuer ?? undefined)}
                              currency={tx.is_swap ? tx.taker_gets?.currency : (tx.delivered_currency || tx.currency)}
                              size={10}
                            />
                            <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                              {txIcon}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium group-hover:text-secondary transition-colors">{txLabel}</p>
                              <Badge
                                variant={tx.result === 'tesSUCCESS' ? 'default' : 'destructive'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {tx.result === 'tesSUCCESS' ? '✓' : '✗'}
                              </Badge>
                            </div>
                            {amountLine && (
                              <p className="text-sm font-medium mt-0.5">
                                {tx.direction === 'received' && !tx.is_swap && <span className="text-primary">+</span>}
                                {tx.direction === 'sent' && !tx.is_swap && <span className="text-destructive">-</span>}
                                {amountLine}
                              </p>
                            )}
                            {counterparty && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {tx.direction === 'received' ? 'From' : 'To'}: {shortenAddress(counterparty)}
                              </p>
                            )}
                            {tx.memos && tx.memos.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
                                "{tx.memos[0]}"
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tx.date ? new Date(tx.date).toLocaleString() : '—'}
                              {tx.fee > 0 && ` • Fee: ${tx.fee} XRP`}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-muted-foreground group-hover:text-secondary transition-colors mt-0.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
      {displayAddress && !isReadOnly && (
        <>
          <ReceiveModal
            isOpen={isReceiveOpen}
            onClose={() => setIsReceiveOpen(false)}
            walletAddress={displayAddress}
            network={network}
          />
          <SendModal
            isOpen={isSendOpen}
            onClose={() => setIsSendOpen(false)}
            walletAddress={displayAddress}
            xrpBalance={xrplData?.xrp_balance}
            tokenHoldings={xrplData?.token_holdings}
            network={network}
          />
        </>
      )}
    </div>
  );
};

export default PortfolioSection;
