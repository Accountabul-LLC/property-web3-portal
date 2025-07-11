import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, DollarSign, BarChart3, Users } from 'lucide-react';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface MarketStatsProps {
  property: PropertyDetail;
}

const MarketStats: React.FC<MarketStatsProps> = ({ property }) => {
  const stats = [
    {
      label: 'Last Trade Price',
      value: `$${property.lastTradePrice}`,
      change: '+2.4%',
      positive: true,
      icon: DollarSign,
    },
    {
      label: 'Estimated Value',
      value: `$${property.estimatedValue.toLocaleString()}`,
      change: '+1.2%',
      positive: true,
      icon: TrendingUp,
    },
    {
      label: 'Trade Volume (24h)',
      value: `$${property.tradeVolume.toLocaleString()}`,
      change: '+15.3%',
      positive: true,
      icon: BarChart3,
    },
    {
      label: 'Market Cap',
      value: `$${property.marketCap.toLocaleString()}`,
      change: '+0.8%',
      positive: true,
      icon: Users,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{stat.value}</div>
                  <div className={`text-xs ${stat.positive ? 'text-success' : 'text-destructive'}`}>
                    {stat.change}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Token Supply Info */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Supply</div>
              <div className="text-lg font-semibold">{property.totalTokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Available</div>
              <div className="text-lg font-semibold text-primary">{property.tokensAvailable.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Token Distribution</span>
              <span>{((property.totalTokens - property.tokensAvailable) / property.totalTokens * 100).toFixed(1)}% Sold</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full"
                style={{ width: `${((property.totalTokens - property.tokensAvailable) / property.totalTokens) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketStats;