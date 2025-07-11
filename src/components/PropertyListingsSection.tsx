import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Bed, Bath, Square, TrendingUp } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  image: string;
  pricePerToken: number;
  totalTokens: number;
  availableTokens: number;
  projectedYield: number;
  status: 'Active' | 'Pending' | 'Sold Out';
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: string;
}

const PropertyListingsSection = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState('');

  // Mock property data
  const properties: Property[] = [
    {
      id: '1',
      title: 'Modern Downtown Condo',
      address: '123 Main Street',
      city: 'Austin',
      state: 'TX',
      image: 'https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=400&h=300&fit=crop',
      pricePerToken: 50,
      totalTokens: 1000,
      availableTokens: 750,
      projectedYield: 8.5,
      status: 'Active',
      bedrooms: 2,
      bathrooms: 2,
      sqft: 1200,
      propertyType: 'Condo'
    },
    {
      id: '2',
      title: 'Luxury Suburban Home',
      address: '456 Oak Avenue',
      city: 'Dallas',
      state: 'TX',
      image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=300&fit=crop',
      pricePerToken: 100,
      totalTokens: 2000,
      availableTokens: 1200,
      projectedYield: 7.2,
      status: 'Active',
      bedrooms: 4,
      bathrooms: 3,
      sqft: 2800,
      propertyType: 'Single Family'
    },
    {
      id: '3',
      title: 'Investment Duplex',
      address: '789 Pine Street',
      city: 'Houston',
      state: 'TX',
      image: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=300&fit=crop',
      pricePerToken: 25,
      totalTokens: 800,
      availableTokens: 0,
      projectedYield: 9.1,
      status: 'Sold Out',
      bedrooms: 6,
      bathrooms: 4,
      sqft: 3200,
      propertyType: 'Multi Family'
    }
  ];

  const propertyTypes = ['Condo', 'Single Family', 'Multi Family', 'Commercial'];
  const statusOptions = ['Active', 'Pending', 'Sold Out'];

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === '' || property.propertyType === selectedType;
    const matchesStatus = selectedStatus === '' || property.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-success text-success-foreground';
      case 'Pending':
        return 'bg-warning text-warning-foreground';
      case 'Sold Out':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const EmptyState = () => (
    <div className="text-center py-16">
      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <MapPin className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-2xl font-semibold mb-4">No Properties Available</h3>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Be the first to tokenize your property and create investment opportunities for others.
      </p>
      <Button variant="hero" size="lg">
        Start Tokenizing
      </Button>
      <p className="text-sm text-muted-foreground mt-4">
        Check back soon for new investment opportunities.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Real Estate Marketplace</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover tokenized real estate investment opportunities with transparent returns and fractional ownership.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by location, property name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Property Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {propertyTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        {filteredProperties.length > 0 && (
          <p className="text-muted-foreground mb-6">
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
          </p>
        )}

        {/* Property Grid */}
        {filteredProperties.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <Card key={property.id} className="overflow-hidden hover:shadow-glow transition-all duration-300 group">
                <div className="relative">
                  <img
                    src={property.image}
                    alt={property.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <Badge 
                    className={`absolute top-3 right-3 ${getStatusColor(property.status)}`}
                  >
                    {property.status}
                  </Badge>
                </div>
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">{property.title}</h3>
                      <div className="flex items-center text-muted-foreground text-sm mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {property.address}, {property.city}, {property.state}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Property Details */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Bed className="w-3 h-3 mr-1" />
                          {property.bedrooms}
                        </span>
                        <span className="flex items-center">
                          <Bath className="w-3 h-3 mr-1" />
                          {property.bathrooms}
                        </span>
                        <span className="flex items-center">
                          <Square className="w-3 h-3 mr-1" />
                          {property.sqft.toLocaleString()} ft²
                        </span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">${property.pricePerToken}</span>
                        <div className="flex items-center text-success text-sm font-medium">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {property.projectedYield}% yield
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        per token • {property.availableTokens.toLocaleString()} of {property.totalTokens.toLocaleString()} available
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((property.totalTokens - property.availableTokens) / property.totalTokens) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(((property.totalTokens - property.availableTokens) / property.totalTokens) * 100)}% funded
                      </p>
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full" 
                      variant={property.status === 'Active' ? 'default' : 'secondary'}
                      disabled={property.status === 'Sold Out'}
                    >
                      {property.status === 'Sold Out' ? 'Sold Out' : 'View Details'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Call to Action */}
        {filteredProperties.length > 0 && (
          <div className="text-center mt-16 p-8 bg-card rounded-lg border">
            <h3 className="text-2xl font-semibold mb-4">Ready to Tokenize Your Property?</h3>
            <p className="text-muted-foreground mb-6">
              Join the future of real estate investment and unlock liquidity for your property.
            </p>
            <Button variant="hero" size="lg">
              Start Tokenizing
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyListingsSection;