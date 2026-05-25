import { Seo } from '@/components/Seo';
import Navigation from '@/components/Navigation';
import PropertyListingsSection from '@/components/PropertyListingsSection';
import Footer from '@/components/Footer';

const Marketplace = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Marketplace | Accountabul"
      description="Browse tokenized real estate listings on Accountabul. Discover fractional property investments with transparent pricing and on-chain ownership."
      path="/marketplace"
    />
    <Navigation />
    <PropertyListingsSection />
    <Footer />
  </div>
);

export default Marketplace;
