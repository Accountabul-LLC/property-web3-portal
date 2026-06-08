import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Mail, Phone, ShieldAlert, Building2 } from 'lucide-react';
import { Property } from '@/hooks/useProperties';

interface Props {
  property: Property;
}

const StandardListingSidebar: React.FC<Props> = ({ property }) => {
  const hasEmail = !!property.contact_email;
  const hasPhone = !!property.contact_phone;

  return (
    <Card className="sticky top-4 border-warning/30">
      <CardHeader className="space-y-2">
        <Badge variant="secondary" className="w-fit bg-muted text-foreground border">
          Standard Listing
        </Badge>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <span>Listing details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-3xl font-bold">
            {property.listing_price != null
              ? `$${Number(property.listing_price).toLocaleString()}`
              : 'Contact for price'}
          </div>
          <div className="text-sm text-muted-foreground">List price</div>
        </div>

        <div className="space-y-3">
          {hasEmail && (
            <Button asChild className="w-full">
              <a href={`mailto:${property.contact_email}`}>
                <Mail className="w-4 h-4 mr-2" />
                Email the lister
              </a>
            </Button>
          )}
          {hasPhone && (
            <Button asChild variant="outline" className="w-full">
              <a href={`tel:${property.contact_phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                {property.contact_phone}
              </a>
            </Button>
          )}
          {!hasEmail && !hasPhone && (
            <p className="text-sm text-muted-foreground text-center">
              No contact info provided by the lister.
            </p>
          )}
        </div>

        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShieldAlert className="w-3.5 h-3.5 text-warning" />
            Not a tokenized asset
          </div>
          <p className="text-muted-foreground">
            This listing is posted by a third-party business. Accountabul does not broker, escrow,
            or verify this transaction. Verify the lister and property before sending any money.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StandardListingSidebar;
