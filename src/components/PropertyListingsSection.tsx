import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MapPin, Bed, Bath, Square, TrendingUp, Loader2, ShieldAlert, CheckSquare, Mail, Phone, Plus } from 'lucide-react';
import { useProperties, Property } from '@/hooks/useProperties';
import { useAuth } from '@/hooks/useAuth';

import { useSavedPropertyIds } from '@/hooks/useSavedProperties';
import PropertySaveButton from './property/PropertySaveButton';
import MarketplaceDisclaimerModal, { hasDismissedMarketplaceDisclaimer } from './marketplace/MarketplaceDisclaimerModal';

function PropertyCard({
  property,
  showCompareToggle = false,
  selectedForCompare = false,
  onToggleCompare,
}: {
  property: Property;
  showCompareToggle?: boolean;
  selectedForCompare?: boolean;
  onToggleCompare?: (propertyId: string) => void;
}) {
  const navigate = useNavigate();
  const isStandard = property.listing_kind === 'standard';

  const kindBadge = isStandard ? (
    <Badge variant="secondary" className="bg-muted text-foreground border">Standard Listing</Badge>
  ) : (
    <Badge className="bg-gradient-primary text-primary-foreground border-0">Tokenized</Badge>
  );

  const statusLabel = property.status === 'active' ? 'Listed' : property.status === 'approved' ? 'Approved' : property.status;
  const statusClass =
    property.status === 'active'
      ? 'bg-success text-success-foreground'
      : property.status === 'approved'
        ? 'bg-warning text-warning-foreground'
        : 'bg-muted text-muted-foreground';

  return (
    <Card className="overflow-hidden hover:shadow-glow transition-all duration-300 group">
      <div className="relative">
        <img
          src={property.images?.[0] || '/placeholder.svg'}
          alt={property.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <PropertySaveButton
            propertyId={property.id}
            propertyStatus={property.status}
            className="bg-background/90 backdrop-blur-sm border-border shadow-sm"
          />
          {kindBadge}
        </div>
        {showCompareToggle && onToggleCompare && (
          <button
            type="button"
            onClick={() => onToggleCompare(property.id)}
            className={`absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors ${
              selectedForCompare
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background/90 border-border text-foreground hover:bg-background'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectedForCompare ? 'Selected' : 'Compare'}
          </button>
        )}
        <Badge className={`absolute top-3 right-3 ${statusClass}`}>
          {statusLabel}
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
                {(property.square_feet || 0).toLocaleString()} sq ft
              </span>
            </div>
          </div>

          {isStandard ? (
            <>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">
                    {property.listing_price != null
                      ? `$${Number(property.listing_price).toLocaleString()}`
                      : 'Contact for price'}
                  </span>
                  <span className="text-xs text-muted-foreground">List price</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Posted by a third-party business. Not a tokenized asset.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {property.contact_email ? (
                  <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {property.contact_email}</span>
                ) : null}
                {property.contact_phone ? (
                  <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {property.contact_phone}</span>
                ) : null}
              </div>

              <Button className="w-full" onClick={() => navigate(`/property/${property.id}`)}>
                View Listing
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${property.price_per_token}</span>
                  <div className="flex items-center text-success text-sm font-medium">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {property.projected_rental_yield}% yield
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  per token • {(property.tokens_available || 0).toLocaleString()} of {(property.total_tokens || 0).toLocaleString()} available
                </p>
              </div>

              <div className="space-y-1">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${property.total_tokens
                        ? ((property.total_tokens - (property.tokens_available || 0)) / property.total_tokens) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {property.total_tokens
                    ? Math.round(((property.total_tokens - (property.tokens_available || 0)) / property.total_tokens) * 100)
                    : 0}% funded
                </p>
              </div>

              <Button
                className="w-full"
                variant={property.status === 'active' ? 'default' : 'secondary'}
                onClick={() => navigate(`/property/${property.id}`)}
              >
                View Details
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const PropertyListingsSection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('all');
  const [selectedStatus, setSelectedStatus] = React.useState('all');
  const [compareIds, setCompareIds] = React.useState<string[]>([]);

  const { data: properties = [], isLoading } = useProperties();
  const { data: savedPropertyIds = [], isLoading: savedLoading } = useSavedPropertyIds();
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') === 'saved' ? 'saved' : 'browse');

  React.useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'saved' ? 'saved' : 'browse');
  }, [searchParams]);

  const propertyTypes = ['Condo', 'Single Family', 'Multi Family', 'Commercial'];
  const statusOptions = ['approved', 'active'];

  const matchesFilters = (property: Property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (property.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (property.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || property.property_type === selectedType;
    const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  };

  const filteredProperties = properties.filter(matchesFilters);
  const savedProperties = properties.filter((property) => savedPropertyIds.includes(property.id));
  const filteredSavedProperties = savedProperties.filter(matchesFilters);
  const compareProperties = savedProperties.filter((property) => compareIds.includes(property.id));

  React.useEffect(() => {
    const savedIds = new Set(savedProperties.map((property) => property.id));
    setCompareIds((current) => current.filter((id) => savedIds.has(id)));
  }, [savedProperties]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value !== 'saved') {
      setCompareIds([]);
    }
    const next = new URLSearchParams(searchParams);
    if (value === 'browse') {
      next.delete('tab');
    } else {
      next.set('tab', value);
    }
    setSearchParams(next, { replace: true });
  };

  const toggleCompareSelection = (propertyId: string) => {
    setCompareIds((current) => {
      if (current.includes(propertyId)) {
        return current.filter((id) => id !== propertyId);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, propertyId];
    });
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
      <Button variant="hero" size="lg" onClick={() => navigate('/tokenize')}>
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Real Estate Marketplace</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover tokenized real estate investment opportunities with transparent returns and fractional ownership.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="browse">Browse Properties</TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              Saved Homes
              <Badge variant="secondary" className="ml-1">
                {savedPropertyIds.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-8">
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
                  <SelectItem value="all">All Types</SelectItem>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {filteredProperties.length > 0 && (
                  <p className="text-muted-foreground mb-6">
                    {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
                  </p>
                )}

                {filteredProperties.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProperties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                )}

                {filteredProperties.length > 0 && (
                  <div className="text-center mt-16 p-8 bg-card rounded-lg border">
                    <h3 className="text-2xl font-semibold mb-4">Ready to Tokenize Your Property?</h3>
                    <p className="text-muted-foreground mb-6">
                      Join the future of real estate investment and unlock liquidity for your property.
                    </p>
                    <Button variant="hero" size="lg" onClick={() => navigate('/tokenize')}>
                      Start Tokenizing
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Saved homes do not require KYC or a wallet.</p>
                    <p className="text-sm text-muted-foreground">
                      Browsing, saving, and comparing are available to any signed-in user.
                      KYC and a connected wallet are only required for financial actions like minting, buying, and selling.
                    </p>
                  </div>
                </div>
                {!user ? (
                  <Button onClick={() => navigate('/auth')}>Sign In</Button>
                ) : null}
              </CardContent>
            </Card>

            {savedLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !user ? (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <p className="text-lg font-medium">Sign in to view your saved homes.</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Your saved list is tied to your account. No wallet or KYC required.
                  </p>
                  <Button onClick={() => navigate('/auth')}>Go to Sign In</Button>
                </CardContent>
              </Card>
            ) : filteredSavedProperties.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <p className="text-lg font-medium">No saved homes yet.</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Tap the heart on any property card or on a property detail page to add it here for later.
                  </p>
                  <Button variant="hero" onClick={() => navigate('/marketplace')}>
                    Browse Marketplace
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <p className="text-muted-foreground">
                    {filteredSavedProperties.length} {filteredSavedProperties.length === 1 ? 'saved home' : 'saved homes'} ready for review
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Compare up to 5 homes, just like Zillow.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSavedProperties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      showCompareToggle
                      selectedForCompare={compareIds.includes(property.id)}
                      onToggleCompare={toggleCompareSelection}
                    />
                  ))}
                </div>
                {compareProperties.length >= 2 && (
                  <Card className="border-primary/30 bg-card/90">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Homes to Compare</p>
                          <p className="text-sm text-muted-foreground">
                            Zillow-style side-by-side review for up to five saved homes.
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setCompareIds([])}>
                          Clear Compare
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        {compareProperties.map((property) => (
                          <div key={property.id} className="rounded-lg border p-3 space-y-2">
                            <img
                              src={property.images?.[0] || '/placeholder.svg'}
                              alt={property.title}
                              className="h-28 w-full rounded-md object-cover"
                            />
                            <p className="font-medium text-sm leading-tight">{property.title}</p>
                            <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                            <p className="text-sm font-semibold">${property.price_per_token} / token</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => navigate(`/property/${property.id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PropertyListingsSection;
