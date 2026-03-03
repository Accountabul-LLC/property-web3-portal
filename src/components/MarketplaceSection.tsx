import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, MapPin, Clock, Shield, Search, Filter, Award, Users, Scale, Calculator, Loader2 } from 'lucide-react';
import { useProfessionals } from '@/hooks/useProfessionals';

const MarketplaceSection = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedService, setSelectedService] = React.useState('all');
  const [selectedLocation, setSelectedLocation] = React.useState('all');

  const { data: professionals = [], isLoading } = useProfessionals();

  const serviceTypes = [
    { value: 'all', label: 'All Services' },
    { value: 'appraisal', label: 'Property Appraisal' },
    { value: 'notary', label: 'Notary Services' },
    { value: 'management', label: 'Property Management' },
    { value: 'legal', label: 'Legal Services' },
    { value: 'inspection', label: 'Property Inspection' },
    { value: 'tax', label: 'Tax Consulting' }
  ];

  // Derive unique locations from data
  const locations = React.useMemo(() => {
    const locs = [...new Set(professionals.map(p => p.location).filter(Boolean))];
    return [{ value: 'all', label: 'All Locations' }, ...locs.map(l => ({ value: l, label: l }))];
  }, [professionals]);

  const filteredProfessionals = professionals.filter(professional => {
    const matchesSearch = professional.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (professional.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (professional.specialties || []).some((s: string) => 
                           s.toLowerCase().includes(searchQuery.toLowerCase())
                         );
    const matchesService = selectedService === 'all' || professional.service_type === selectedService;
    const matchesLocation = selectedLocation === 'all' || professional.location === selectedLocation;
    
    return matchesSearch && matchesService && matchesLocation;
  });

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'appraisal': return <Award className="w-5 h-5" />;
      case 'notary': return <Shield className="w-5 h-5" />;
      case 'management': return <Users className="w-5 h-5" />;
      case 'legal': return <Scale className="w-5 h-5" />;
      case 'inspection': return <Search className="w-5 h-5" />;
      case 'tax': return <Calculator className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
          Professional Services Marketplace
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Connect with verified real estate professionals for appraisals, legal services, 
          property management, and more. All payments secured through smart contracts.
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 mb-8 bg-gradient-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search professionals, services, or specialties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger>
              <SelectValue placeholder="Service Type" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((service) => (
                <SelectItem key={service.value} value={service.value}>
                  {service.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger>
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.value} value={location.value}>
                  {location.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          Showing {filteredProfessionals.length} professional{filteredProfessionals.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select defaultValue="rating">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Sort by Rating</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="response">Response Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Professionals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfessionals.map((professional) => (
              <Card key={professional.id} className="p-6 hover:shadow-card transition-all duration-300 group">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">{professional.name}</h3>
                      {professional.verified && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{professional.title}</p>
                    <div className="flex items-center space-x-1 mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3 h-3 ${i < Math.floor(professional.rating || 0) ? 'text-warning fill-current' : 'text-muted'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{professional.rating}</span>
                      <span className="text-xs text-muted-foreground">({professional.review_count})</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {professional.description}
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{professional.location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Responds {professional.response_time}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span>{professional.completed_jobs} completed jobs</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(professional.specialties || []).slice(0, 2).map((specialty: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                    {(professional.specialties || []).length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{professional.specialties.length - 2} more
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-primary">{professional.price_range}</p>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Profile
                  </Button>
                  <Button variant="hero" size="sm" className="flex-1">
                    Book Service
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredProfessionals.length === 0 && (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No professionals found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or browse all available services.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedService('all');
                  setSelectedLocation('all');
                }}
              >
                Clear Filters
              </Button>
            </Card>
          )}
        </>
      )}

      {/* Call to Action */}
      <Card className="p-8 mt-12 bg-gradient-hero text-primary-foreground text-center">
        <h3 className="text-2xl font-bold mb-4">Are you a real estate professional?</h3>
        <p className="text-lg mb-6 opacity-90">
          Join our marketplace and connect with property owners looking for verified services.
        </p>
        <Button variant="secondary" size="lg">
          Apply to Join Marketplace
        </Button>
      </Card>
    </div>
  );
};

export default MarketplaceSection;
