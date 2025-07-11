import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface FinancialSidebarProps {
  property: PropertyDetail;
}

const FinancialSidebar: React.FC<FinancialSidebarProps> = ({ property }) => {
  const [membershipCheck, setMembershipCheck] = React.useState(false);

  const handleBuyTokens = () => {
    // Placeholder for membership/wallet check
    setMembershipCheck(true);
    setTimeout(() => setMembershipCheck(false), 2000);
  };

  const handleSellTokens = () => {
    // Placeholder for membership/wallet check
    setMembershipCheck(true);
    setTimeout(() => setMembershipCheck(false), 2000);
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Investment Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price per Token */}
        <div className="text-center">
          <div className="text-3xl font-bold text-foreground">${property.pricePerToken}</div>
          <div className="text-sm text-muted-foreground">per token</div>
          <div className="flex items-center justify-center mt-1">
            <TrendingUp className="w-4 h-4 text-success mr-1" />
            <span className="text-sm text-success">+2.4% (24h)</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Projected Annual Return</span>
            <span className="font-medium text-success">{property.projectedAnnualReturn}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Projected Rental Yield</span>
            <span className="font-medium">{property.projectedRentalYield}%</span>
          </div>
          
          {property.actualYield && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Actual Yield</span>
              <span className="font-medium text-primary">{property.actualYield}%</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tokens Available</span>
            <span className="font-medium">{property.tokensAvailable}/{property.totalTokens}</span>
          </div>
        </div>

        {/* Token Availability */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Availability</span>
            <span>{((property.tokensAvailable / property.totalTokens) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full"
              style={{ width: `${(property.tokensAvailable / property.totalTokens) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={handleBuyTokens}
            disabled={membershipCheck}
          >
            {membershipCheck ? 'Checking Membership...' : 'Buy Tokens'}
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSellTokens}
            disabled={membershipCheck}
          >
            {membershipCheck ? 'Checking Wallet...' : 'Sell Tokens'}
          </Button>
        </div>

        {/* Additional Info */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Minimum investment: 1 token</p>
            <p>• Transaction fees: 2.5%</p>
            <p>• Instant settlement</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialSidebar;