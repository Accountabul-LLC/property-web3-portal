import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { DollarSign } from 'lucide-react';
import PrototypeNotice from '@/components/PrototypeNotice';
import { PROTOTYPE_DISABLED_LABEL } from '@/lib/prototypeSafety';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface FinancialSidebarProps {
  property: PropertyDetail;
}

const FinancialSidebar: React.FC<FinancialSidebarProps> = ({ property }) => {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Listing details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price per Token */}
        <div className="text-center">
          <div className="text-3xl font-bold text-foreground">${property.pricePerToken}</div>
          <div className="text-sm text-muted-foreground">indicative price per token</div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimate provided by lister</span>
            <span className="font-medium">{property.projectedAnnualReturn}%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated rental yield</span>
            <span className="font-medium">{property.projectedRentalYield}%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tokens defined</span>
            <span className="font-medium">{property.tokensAvailable}/{property.totalTokens}</span>
          </div>
        </div>

        {/* Token Availability */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Defined supply remaining</span>
            <span>{((property.tokensAvailable / property.totalTokens) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{ width: `${(property.tokensAvailable / property.totalTokens) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons: intentionally disabled in the prototype */}
        <div className="space-y-3">
          <Button className="w-full" disabled aria-disabled="true">
            Buy tokens ({PROTOTYPE_DISABLED_LABEL})
          </Button>

          <Button variant="outline" className="w-full" disabled aria-disabled="true">
            Sell tokens ({PROTOTYPE_DISABLED_LABEL})
          </Button>
        </div>

        <PrototypeNotice variant="inline">
          Buying and selling are not implemented. Figures shown are estimates entered by the lister, not verified
          valuations, and not a promise of any return.
        </PrototypeNotice>
      </CardContent>
    </Card>
  );
};

export default FinancialSidebar;