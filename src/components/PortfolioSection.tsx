import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Building2, Wallet, DollarSign, PieChart, ArrowUpDown, Plus, Loader2 } from 'lucide-react';
import { usePortfolioHoldings, usePortfolioTransactions } from '@/hooks/usePortfolio';
import { useWalletAuth } from '@/hooks/useWalletAuth';

const PortfolioSection = () => {
  const { walletAddress, isConnected } = useWalletAuth();
  const { data: holdings = [], isLoading: holdingsLoading } = usePortfolioHoldings(walletAddress);
  const { data: transactions = [], isLoading: txLoading } = usePortfolioTransactions(walletAddress);

  const isLoading = holdingsLoading || txLoading;

  const totalValue = holdings.reduce((sum, h) => sum + (h.tokens_owned * h.average_purchase_price), 0);
  const totalTokens = holdings.reduce((sum, h) => sum + h.tokens_owned, 0);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy': return <Plus className="w-4 h-4 text-success" />;
      case 'sell': return <ArrowUpDown className="w-4 h-4 text-destructive" />;
      default: return <ArrowUpDown className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
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
          Your Real Estate Portfolio
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Track your tokenized real estate investments, monitor yields, and manage your holdings.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
                  <PieChart className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Properties</p>
                  <p className="text-2xl font-bold">{holdings.length}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Holdings */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Property Holdings</h3>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Buy More Tokens
                </Button>
              </div>

              {holdings.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">No Holdings Yet</h4>
                  <p className="text-muted-foreground">Browse the marketplace to start investing in tokenized properties.</p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {holdings.map((holding) => (
                    <Card key={holding.id} className="p-6 hover:shadow-card transition-all duration-300">
                      <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6">
                        <div className="w-full md:w-32 h-24 bg-muted rounded-lg flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">Property</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Tokens Owned</p>
                              <p className="font-semibold">{holding.tokens_owned}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Price</p>
                              <p className="font-semibold">{formatCurrency(holding.average_purchase_price)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Value</p>
                              <p className="font-semibold">{formatCurrency(holding.tokens_owned * holding.average_purchase_price)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <Button variant="outline" size="sm">Trade</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Transactions */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Recent Transactions</h3>
              <Card className="p-6">
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center space-x-3 py-3 border-b border-border last:border-b-0">
                        <div className="flex-shrink-0">
                          {getTransactionIcon(tx.transaction_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.transaction_type.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.tokens} tokens • {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(tx.total_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PortfolioSection;
