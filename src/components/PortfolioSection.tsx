import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Building2, Wallet, DollarSign, PieChart, ArrowUpDown, ArrowDownLeft, ArrowUpRight, Plus, Loader2, Coins, ExternalLink, QrCode, Send } from 'lucide-react';
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import ReceiveModal from '@/components/ReceiveModal';
import SendModal from '@/components/SendModal';

const PortfolioSection = () => {
  const { walletAddress, isConnected } = useWalletAuth();
  const { data: xrplData, isLoading, error } = useXRPLPortfolio(walletAddress);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);

  const formatXRP = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const shortenAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const decodeCurrency = (hex: string) => {
    if (hex.length <= 3) return hex;
    try {
      const decoded = hex.replace(/0+$/, '').replace(/../g, (m: string) => String.fromCharCode(parseInt(m, 16)));
      return decoded || hex;
    } catch {
      return hex;
    }
  };

  if (!isConnected) {
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
          Live on-chain data for <span className="font-mono text-sm">{shortenAddress(walletAddress!)}</span>
        </p>
        <div className="flex justify-center gap-3 mt-4">
          <Button onClick={() => setIsSendOpen(true)} className="gap-2">
            <Send className="w-4 h-4" /> Send
          </Button>
          <Button onClick={() => setIsReceiveOpen(true)} variant="outline" className="gap-2">
            <QrCode className="w-4 h-4" /> Receive
          </Button>
        </div>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XRP Balance</p>
                  <p className="text-2xl font-bold">{formatXRP(xrplData.xrp_balance)} XRP</p>
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
                  <p className="text-2xl font-bold">{xrplData.token_holdings.length}</p>
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

              {xrplData.token_holdings.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
                    <Coins className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">No Token Holdings</h4>
                  <p className="text-muted-foreground">This wallet has no active trustlines with balances.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {xrplData.token_holdings.map((token, idx) => (
                    <Card key={`${token.currency}-${token.issuer}-${idx}`} className="p-5 hover:shadow-card transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Coins className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{decodeCurrency(token.currency)}</p>
                            <p className="text-xs text-muted-foreground font-mono">{shortenAddress(token.issuer)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{Number(token.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                          <p className="text-xs text-muted-foreground">Limit: {Number(token.limit).toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Recent Transactions</h3>
              <Card className="p-6">
                {xrplData.transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions found</p>
                ) : (
                  <div className="space-y-4">
                    {xrplData.transactions.map((tx) => (
                      <div key={tx.hash} className="flex items-center space-x-3 py-3 border-b border-border last:border-b-0">
                        <div className="flex-shrink-0">
                          {tx.direction === 'received' ? (
                            <ArrowDownLeft className="w-4 h-4 text-primary" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{tx.type}</p>
                            <Badge variant={tx.result === 'tesSUCCESS' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                              {tx.result === 'tesSUCCESS' ? '✓' : '✗'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tx.amount > 0 ? `${formatXRP(tx.amount)} ${tx.currency}` : '—'}
                            {tx.date ? ` • ${new Date(tx.date).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <a
                          href={`https://livenet.xrpl.org/transactions/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
      {walletAddress && (
        <>
          <ReceiveModal
            isOpen={isReceiveOpen}
            onClose={() => setIsReceiveOpen(false)}
            walletAddress={walletAddress}
          />
          <SendModal
            isOpen={isSendOpen}
            onClose={() => setIsSendOpen(false)}
            walletAddress={walletAddress}
            xrpBalance={xrplData?.xrp_balance}
            tokenHoldings={xrplData?.token_holdings}
          />
        </>
      )}
    </div>
  );
};

export default PortfolioSection;
