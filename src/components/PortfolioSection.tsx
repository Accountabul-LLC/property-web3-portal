import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Building2, Wallet, DollarSign, PieChart, ArrowUpDown, Plus } from 'lucide-react';

const PortfolioSection = () => {
  const portfolioSummary = {
    totalValue: 125750,
    totalTokens: 2500,
    activeStakes: 1800,
    monthlyYield: 2340,
    totalReturn: 15.2
  };

  const properties = [
    {
      id: 1,
      name: 'Oceanview Apartments',
      location: 'Miami, FL',
      image: '/api/placeholder/300/200',
      tokensOwned: 850,
      totalTokens: 100,
      value: 85000,
      monthlyYield: 1275,
      yieldRate: 8.2,
      change24h: 2.4,
      status: 'active'
    },
    {
      id: 2,
      name: 'Downtown Office Complex',
      location: 'Austin, TX',
      image: '/api/placeholder/300/200',
      tokensOwned: 420,
      totalTokens: 100,
      value: 42000,
      monthlyYield: 630,
      yieldRate: 6.8,
      change24h: -1.2,
      status: 'active'
    },
    {
      id: 3,
      name: 'Suburban Family Home',
      location: 'Denver, CO',
      image: '/api/placeholder/300/200',
      tokensOwned: 1230,
      totalTokens: 100,
      value: 123000,
      monthlyYield: 1845,
      yieldRate: 7.5,
      change24h: 3.1,
      status: 'staked'
    }
  ];

  const transactions = [
    {
      id: 1,
      type: 'buy',
      property: 'Oceanview Apartments',
      tokens: 250,
      value: 25000,
      date: '2024-01-15',
      status: 'completed'
    },
    {
      id: 2,
      type: 'stake',
      property: 'Suburban Family Home',
      tokens: 500,
      value: 50000,
      date: '2024-01-14',
      status: 'completed'
    },
    {
      id: 3,
      type: 'yield',
      property: 'Downtown Office Complex',
      tokens: 0,
      value: 630,
      date: '2024-01-13',
      status: 'received'
    },
    {
      id: 4,
      type: 'sell',
      property: 'Oceanview Apartments',
      tokens: 100,
      value: 10200,
      date: '2024-01-12',
      status: 'completed'
    }
  ];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <Plus className="w-4 h-4 text-success" />;
      case 'sell':
        return <ArrowUpDown className="w-4 h-4 text-destructive" />;
      case 'stake':
        return <PieChart className="w-4 h-4 text-secondary" />;
      case 'yield':
        return <DollarSign className="w-4 h-4 text-warning" />;
      default:
        return <ArrowUpDown className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

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

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <p className="text-2xl font-bold">{formatCurrency(portfolioSummary.totalValue)}</p>
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
              <p className="text-2xl font-bold">{portfolioSummary.totalTokens.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <PieChart className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Staked Tokens</p>
              <p className="text-2xl font-bold">{portfolioSummary.activeStakes.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-success to-success/80 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-success-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Yield</p>
              <p className="text-2xl font-bold">{formatCurrency(portfolioSummary.monthlyYield)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-warning to-warning/80 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-warning-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Return</p>
              <p className="text-2xl font-bold text-success">+{portfolioSummary.totalReturn}%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Properties List */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">Property Holdings</h3>
            <Button variant="hero">
              <Plus className="w-4 h-4 mr-2" />
              Buy More Tokens
            </Button>
          </div>

          <div className="space-y-6">
            {properties.map((property) => (
              <Card key={property.id} className="p-6 hover:shadow-card transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6">
                  <div className="w-full md:w-32 h-24 bg-muted rounded-lg flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-lg">{property.name}</h4>
                        <p className="text-muted-foreground">{property.location}</p>
                      </div>
                      <Badge variant={property.status === 'staked' ? 'secondary' : 'outline'}>
                        {property.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Tokens Owned</p>
                        <p className="font-semibold">{property.tokensOwned}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Token Value</p>
                        <p className="font-semibold">{formatCurrency(property.value)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Yield</p>
                        <p className="font-semibold text-success">{formatCurrency(property.monthlyYield)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">24h Change</p>
                        <div className="flex items-center space-x-1">
                          {property.change24h > 0 ? (
                            <TrendingUp className="w-3 h-3 text-success" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-destructive" />
                          )}
                          <p className={`font-semibold text-sm ${property.change24h > 0 ? 'text-success' : 'text-destructive'}`}>
                            {property.change24h > 0 ? '+' : ''}{property.change24h}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Button variant="outline" size="sm">Trade</Button>
                    <Button variant="secondary" size="sm">Stake</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h3 className="text-2xl font-bold mb-6">Recent Transactions</h3>
          <Card className="p-6">
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center space-x-3 py-3 border-b border-border last:border-b-0">
                  <div className="flex-shrink-0">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{transaction.property}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.type.toUpperCase()} • {transaction.date}
                    </p>
                  </div>
                  <div className="text-right">
                    {transaction.tokens > 0 && (
                      <p className="text-xs text-muted-foreground">{transaction.tokens} tokens</p>
                    )}
                    <p className="text-sm font-medium">{formatCurrency(transaction.value)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All Transactions
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSection;