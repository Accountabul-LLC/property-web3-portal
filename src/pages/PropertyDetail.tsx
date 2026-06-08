import React, { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import PhotoGallery from '../components/property/PhotoGallery';
import PropertySummary from '../components/property/PropertySummary';
import FinancialSidebar from '../components/property/FinancialSidebar';
import StandardListingSidebar from '../components/property/StandardListingSidebar';
import MarketStats from '../components/property/MarketStats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import DetailsTab from '../components/property/DetailsTab';
import OrderBook from '../components/property/OrderBook';
import DocumentsTab from '../components/property/DocumentsTab';
import ReviewsTab from '../components/property/ReviewsTab';
import { useProperty } from '@/hooks/useProperties';
import { ChartPanelSkeleton, PropertyDetailLoadingSkeleton } from '@/components/PageSkeletons';
import { Seo } from '@/components/Seo';

const PriceChart = React.lazy(() => import('../components/property/PriceChart'));
const FinancialsTab = React.lazy(() => import('../components/property/FinancialsTab'));
const MarketTab = React.lazy(() => import('../components/property/MarketTab'));

// Property interface for detailed view (used by sub-components)
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

// Map DB row to the PropertyDetail shape sub-components expect
function mapToPropertyDetail(row: any): PropertyDetail {
  return {
    id: row.id,
    title: row.title || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    status: (row.status as any) || 'Active',
    pricePerToken: Number(row.price_per_token) || 0,
    totalTokens: row.total_tokens || 0,
    tokensAvailable: row.tokens_available || 0,
    projectedAnnualReturn: Number(row.projected_annual_return) || 0,
    projectedRentalYield: Number(row.projected_rental_yield) || 0,
    images: row.images || [],
    description: row.description || '',
    propertyType: row.property_type || '',
    bedrooms: row.bedrooms || 0,
    bathrooms: row.bathrooms || 0,
    squareFeet: row.square_feet || 0,
    yearBuilt: row.year_built || 0,
    amenities: row.amenities || [],
    marketCap: Number(row.market_cap) || 0,
    lastTradePrice: Number(row.price_per_token) || 0,
    estimatedValue: Number(row.estimated_value) || 0,
    tradeVolume: 0,
    management: { name: '', bio: '', avatar: '', isSuperhostAirbnb: false },
    financials: { totalRaise: 0, assetValue: Number(row.estimated_value) || 0, closingCosts: 0, operatingReserves: 0, capRate: 0, annualIncome: 0, appreciation: 0 },
    reviews: [],
    documents: [],
    marketData: { regionGrowth: 0, priceAppreciation: 0, demandIndex: 0 },
  };
}

const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: dbProperty, isLoading, error } = useProperty(id);
  const [activeTab, setActiveTab] = React.useState('details');

  const property = dbProperty ? mapToPropertyDetail(dbProperty) : null;

  if (isLoading) {
    return <PropertyDetailLoadingSkeleton />;
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <p className="text-muted-foreground">This property doesn't exist or has been removed.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${property.title} | Accountabul`}
        description={`${property.title} in ${property.city}, ${property.state}. View tokenized property details, financials, and on-chain ownership on Accountabul.`.slice(0, 160)}
        path={`/property/${id}`}
      />
      <Navigation />
      
      
      <main className="container mx-auto px-4 py-8">
        {dbProperty?.listing_kind === 'standard' && (
          <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="font-medium">Standard Listing — not a tokenized asset.</p>
            <p className="text-muted-foreground mt-1">
              This property is posted by a third-party business. Accountabul does not broker or escrow this sale.
              Verify the lister and property before sending any money.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <PhotoGallery images={property.images} title={property.title} />
            <PropertySummary property={property} />
          </div>
          <div className="lg:col-span-1">
            {dbProperty?.listing_kind === 'standard' ? (
              <StandardListingSidebar property={dbProperty} />
            ) : (
              <FinancialSidebar property={property} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Suspense fallback={<ChartPanelSkeleton />}>
            <PriceChart />
          </Suspense>
          <MarketStats property={property} />
        </div>

        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                {activeTab === 'financials' ? (
                  <Suspense fallback={<ChartPanelSkeleton />}>
                    <FinancialsTab property={property} />
                  </Suspense>
                ) : (
                  <ChartPanelSkeleton />
                )}
              </TabsContent>
              <TabsContent value="orderbook" className="space-y-6">
                <OrderBook />
              </TabsContent>
              <TabsContent value="documents" className="space-y-6">
                <DocumentsTab propertyId={id} />
              </TabsContent>
              <TabsContent value="market" className="space-y-6">
                {activeTab === 'market' ? (
                  <Suspense fallback={<ChartPanelSkeleton />}>
                    <MarketTab property={property} />
                  </Suspense>
                ) : (
                  <ChartPanelSkeleton />
                )}
              </TabsContent>
              <TabsContent value="reviews" className="space-y-6">
                <ReviewsTab propertyId={id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PropertyDetailPage;
