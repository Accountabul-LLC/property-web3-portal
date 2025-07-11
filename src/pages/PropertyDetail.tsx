import React from 'react';
import { useParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import PhotoGallery from '../components/property/PhotoGallery';
import PropertySummary from '../components/property/PropertySummary';
import FinancialSidebar from '../components/property/FinancialSidebar';
import PriceChart from '../components/property/PriceChart';
import MarketStats from '../components/property/MarketStats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import DetailsTab from '../components/property/DetailsTab';
import FinancialsTab from '../components/property/FinancialsTab';
import OrderBook from '../components/property/OrderBook';
import DocumentsTab from '../components/property/DocumentsTab';
import MarketTab from '../components/property/MarketTab';
import ReviewsTab from '../components/property/ReviewsTab';

// Property interface for detailed view
export interface PropertyDetail {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: 'Active' | 'Sold' | 'Coming Soon';
  pricePerToken: number;
  totalTokens: number;
  tokensAvailable: number;
  projectedAnnualReturn: number;
  projectedRentalYield: number;
  actualYield?: number;
  images: string[];
  description: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt: number;
  amenities: string[];
  marketCap: number;
  lastTradePrice: number;
  estimatedValue: number;
  tradeVolume: number;
  management: {
    name: string;
    bio: string;
    avatar: string;
    isSuperhostAirbnb: boolean;
  };
  financials: {
    totalRaise: number;
    assetValue: number;
    closingCosts: number;
    operatingReserves: number;
    capRate: number;
    annualIncome: number;
    appreciation: number;
  };
  reviews: Array<{
    id: string;
    userName: string;
    rating: number;
    comment: string;
    ownershipPercentage: number;
    date: string;
  }>;
  documents: Array<{
    name: string;
    type: string;
    url: string;
  }>;
  marketData: {
    regionGrowth: number;
    priceAppreciation: number;
    demandIndex: number;
  };
}

// Mock property data
const mockPropertyData: PropertyDetail = {
  id: '1',
  title: 'Luxury Downtown Condo with City Views',
  address: '123 Main Street',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  status: 'Active',
  pricePerToken: 250,
  totalTokens: 1000,
  tokensAvailable: 750,
  projectedAnnualReturn: 8.5,
  projectedRentalYield: 6.2,
  actualYield: 7.1,
  images: [
    '/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png',
    '/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png',
    '/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png',
  ],
  description: 'This stunning downtown condo offers breathtaking city views and modern amenities. Located in the heart of Austin\'s business district, this property provides exceptional rental income potential with strong appreciation prospects.',
  propertyType: 'Condo',
  bedrooms: 2,
  bathrooms: 2,
  squareFeet: 1200,
  yearBuilt: 2018,
  amenities: ['Pool', 'Gym', 'Concierge', 'Rooftop Deck', 'Parking'],
  marketCap: 250000,
  lastTradePrice: 252,
  estimatedValue: 255000,
  tradeVolume: 12500,
  management: {
    name: 'Sarah Johnson',
    bio: 'Professional property manager with 10+ years experience in Austin real estate market. Airbnb Superhost with 4.9 rating.',
    avatar: '/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png',
    isSuperhostAirbnb: true,
  },
  financials: {
    totalRaise: 250000,
    assetValue: 240000,
    closingCosts: 8000,
    operatingReserves: 15000,
    capRate: 6.5,
    annualIncome: 18000,
    appreciation: 5.2,
  },
  reviews: [
    {
      id: '1',
      userName: 'Michael Chen',
      rating: 5,
      comment: 'Excellent property with great returns. Management is very responsive.',
      ownershipPercentage: 12.5,
      date: '2024-01-15',
    },
    {
      id: '2',
      userName: 'Jennifer Davis',
      rating: 4,
      comment: 'Good investment so far. Location is perfect.',
      ownershipPercentage: 8.3,
      date: '2024-01-10',
    },
  ],
  documents: [
    { name: 'Property Deed', type: 'PDF', url: '#' },
    { name: 'Appraisal Report', type: 'PDF', url: '#' },
    { name: 'Inspection Report', type: 'PDF', url: '#' },
    { name: 'LLC Formation', type: 'PDF', url: '#' },
  ],
  marketData: {
    regionGrowth: 12.8,
    priceAppreciation: 8.4,
    demandIndex: 85,
  },
};

const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [property] = React.useState<PropertyDetail>(mockPropertyData);

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSectionChange={() => {}} currentSection="property" />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column - Gallery and Summary */}
          <div className="lg:col-span-2 space-y-6">
            <PhotoGallery images={property.images} title={property.title} />
            <PropertySummary property={property} />
          </div>
          
          {/* Right Column - Financial Sidebar */}
          <div className="lg:col-span-1">
            <FinancialSidebar property={property} />
          </div>
        </div>

        {/* Market Data Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <PriceChart />
          <MarketStats property={property} />
        </div>

        {/* Main Content Tabs */}
        <div className="w-full">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="orderbook">Order Book</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            
            <div className="mt-6">
              <TabsContent value="details" className="space-y-6">
                <DetailsTab property={property} />
              </TabsContent>
              
              <TabsContent value="financials" className="space-y-6">
                <FinancialsTab property={property} />
              </TabsContent>
              
              <TabsContent value="orderbook" className="space-y-6">
                <OrderBook />
              </TabsContent>
              
              <TabsContent value="documents" className="space-y-6">
                <DocumentsTab documents={property.documents} />
              </TabsContent>
              
              <TabsContent value="market" className="space-y-6">
                <MarketTab property={property} />
              </TabsContent>
              
              <TabsContent value="reviews" className="space-y-6">
                <ReviewsTab reviews={property.reviews} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PropertyDetail;