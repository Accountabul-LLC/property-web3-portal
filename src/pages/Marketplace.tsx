import Navigation from '@/components/Navigation';
import PropertyListingsSection from '@/components/PropertyListingsSection';
import Footer from '@/components/Footer';

const Marketplace = () => (
  <div className="min-h-screen bg-background">
    <Navigation />
    <PropertyListingsSection />
    <Footer />
  </div>
);

export default Marketplace;
