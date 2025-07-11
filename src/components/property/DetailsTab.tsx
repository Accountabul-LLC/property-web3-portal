import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { MapPin, Calendar, Home, Star } from 'lucide-react';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface DetailsTabProps {
  property: PropertyDetail;
}

const DetailsTab: React.FC<DetailsTabProps> = ({ property }) => {
  return (
    <div className="space-y-6">
      {/* Property Description */}
      <Card>
        <CardHeader>
          <CardTitle>Property Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {property.description}
          </p>
          <div className="mt-4 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {property.address}, {property.city}, {property.state} {property.zip}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Offering Details */}
      <Card>
        <CardHeader>
          <CardTitle>Offering Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Structure</span>
              <p className="font-medium">Delaware LLC</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Token Standard</span>
              <p className="font-medium">ERC-20</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Minimum Investment</span>
              <p className="font-medium">1 Token ($250)</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Governance Rights</span>
              <p className="font-medium">Voting Rights Included</p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border">
            <h4 className="font-medium mb-2">Token Rights</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Proportional ownership of property</li>
              <li>• Quarterly rental income distributions</li>
              <li>• Voting rights on major property decisions</li>
              <li>• Share in property appreciation upon sale</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{property.bedrooms}</div>
              <div className="text-sm text-muted-foreground">Bedrooms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{property.bathrooms}</div>
              <div className="text-sm text-muted-foreground">Bathrooms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{property.squareFeet.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Sq Ft</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{property.yearBuilt}</div>
              <div className="text-sm text-muted-foreground">Year Built</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Amenities</h4>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((amenity, index) => (
                <Badge key={index} variant="secondary">
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Property Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={property.management.avatar} alt={property.management.name} />
              <AvatarFallback>{property.management.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="font-semibold">{property.management.name}</h4>
                {property.management.isSuperhostAirbnb && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Airbnb Superhost
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {property.management.bio}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DetailsTab;