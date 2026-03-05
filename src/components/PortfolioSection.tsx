import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, PieChart, ArrowUpDown, ArrowDownLeft, ArrowUpRight, Loader2, Coins, ExternalLink, QrCode, Send, Repeat, Settings, ShieldCheck, Globe, Users, BarChart3, ChevronDown, ChevronUp, Info, RefreshCw, DollarSign, Clock } from 'lucide-react';
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useXRPLSubscription } from '@/hooks/useXRPLSubscription';
import { useTokenMeta } from '@/hooks/useTokenMeta';
import ReceiveModal from '@/components/ReceiveModal';
import SendModal from '@/components/SendModal';

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
}

const PortfolioSection = ({ overrideAddress, isReadOnly = false }: PortfolioSectionProps) => {
  const { activeAddress, activeWallet, isConnected } = useActiveWallet();
  const displayAddress = overrideAddress || activeAddress;
  const hasWallet = overrideAddress ? !!overrideAddress : isConnected;
  const { data: xrplData, isLoading, error, dataUpdatedAt, refetch, isFetching } = useXRPLPortfolio(displayAddress);
  useXRPLSubscription(displayAddress);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  // Fetch enriched metadata for all token holdings
  const { data: tokenMetaData } = useTokenMeta(
    xrplData?.token_holdings.map((t) => ({ currency: t.currency, issuer: t.issuer }))
  );
  const tokenMetaMap = tokenMetaData?.tokenMap;
  const xrpUsdPrice = tokenMetaData?.xrpUsd ?? 0;

  // Compute total wallet USD value
  const portfolioValuation = useMemo(() => {
    if (!xrplData) return null;

    const xrpSubtotal = xrpUsdPrice > 0 ? (xrplData.xrp_balance ?? 0) * xrpUsdPrice : 0;
    let tokenSubtotal = 0;
    let pricedCount = 0;
    let unpricedCount = 0;

    const assetValues: Array<{ key: string; subtotalUsd: number | null; priceUsd: number | null; priceSource: string }> = [];

    // XRP
    assetValues.push({
      key: 'XRP_NATIVE',
      subtotalUsd: xrpUsdPrice > 0 ? xrpSubtotal : null,
      priceUsd: xrpUsdPrice > 0 ? xrpUsdPrice : null,
      priceSource: xrpUsdPrice > 0 ? 'market' : 'unavailable',
    });
    if (xrpUsdPrice > 0) pricedCount++; else unpricedCount++;

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

    return {
      totalUsd: xrpSubtotal + tokenSubtotal,
      xrpSubtotal,
      tokenSubtotal,
      pricedCount,
      unpricedCount,
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
  }, [dataUpdatedAt, isFetching]); // re-evaluate on refetch

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
          Your XRPL Portfolio
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {isReadOnly ? 'Viewing portfolio for' : 'Live on-chain data for'}{' '}
          {!isReadOnly && activeWallet?.xamanName && (
            <span className="font-semibold text-foreground">{activeWallet.xamanName} · </span>
          )}
          {!isReadOnly && activeWallet?.label && activeWallet.label !== activeWallet.xamanName && (
            <span className="text-foreground">{activeWallet.label} · </span>
          )}
          <span className="font-mono text-sm">{shortenAddress(displayAddress!)}</span>
        </p>
        {!isReadOnly && (
          <div className="flex justify-center gap-3 mt-4">
            <Button onClick={() => setIsSendOpen(true)} className="gap-2">
              <Send className="w-4 h-4" /> Send
            </Button>
            <Button onClick={() => setIsReceiveOpen(true)} variant="outline" className="gap-2">
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
            <Card className="p-6 mb-8 bg-gradient-card border-primary/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Account Worth</p>
                  </div>
                  <p className="text-4xl font-bold tracking-tight">
                    ${portfolioValuation.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {updatedAgo || 'now'}
                    </span>
                    {portfolioValuation.unpricedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {portfolioValuation.unpricedCount} asset{portfolioValuation.unpricedCount > 1 ? 's' : ''} without USD price
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spendable XRP</p>
                  <p className="text-2xl font-bold">{formatXRP(xrplData.spendable_xrp)}</p>
                  {xrpUsdPrice > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ ${((xrplData.spendable_xrp ?? 0) * xrpUsdPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                    </p>
                  )}
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
                  <p className="text-2xl font-bold">{xrplData.token_holdings.length + 1}</p>
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
                              href={`https://livenet.xrpl.org/accounts/${displayAddress}`}
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
                  const explorerUrl = `https://livenet.xrpl.org/token/${token.currency}.${token.issuer}`;
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

                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>Issuer:</span>
                            <span>{token.issuer}</span>
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

                      return (
                        <a
                          key={tx.hash}
                          href={`https://livenet.xrpl.org/transactions/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start space-x-3 py-3 px-3 -mx-3 rounded-lg border-b border-border last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-secondary/15 hover:border-secondary/30 group"
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
          />
          <SendModal
            isOpen={isSendOpen}
            onClose={() => setIsSendOpen(false)}
            walletAddress={displayAddress}
            xrpBalance={xrplData?.xrp_balance}
            tokenHoldings={xrplData?.token_holdings}
          />
        </>
      )}
    </div>
  );
};

export default PortfolioSection;
