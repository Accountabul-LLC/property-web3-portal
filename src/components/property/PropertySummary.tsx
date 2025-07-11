import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Heart, Bell, Star, MapPin } from 'lucide-react';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface PropertySummaryProps {
  property: PropertyDetail;
}

const PropertySummary: React.FC<PropertySummaryProps> = ({ property }) => {
  const [isSaved, setIsSaved] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);

  const averageRating = property.reviews.reduce((sum, review) => sum + review.rating, 0) / property.reviews.length;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col space-y-4">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <Badge 
              variant={property.status === 'Active' ? 'default' : property.status === 'Sold' ? 'destructive' : 'secondary'}
            >
              {property.status}
            </Badge>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaved(!isSaved)}
                className={isSaved ? 'text-destructive' : ''}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={notificationsEnabled ? 'text-primary' : ''}
              >
                <Bell className={`w-4 h-4 ${notificationsEnabled ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Title and Address */}
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{property.title}</h1>
            <div className="flex items-center text-muted-foreground">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed">
            {property.description}
          </p>

          {/* Reviews Summary */}
          <div className="flex items-center space-x-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${i < Math.floor(averageRating) ? 'text-warning fill-current' : 'text-muted-foreground'}`} 
                  />
                ))}
              </div>
              <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
            </div>
            <button className="text-sm text-primary hover:underline">
              View {property.reviews.length} co-owner reviews
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertySummary;