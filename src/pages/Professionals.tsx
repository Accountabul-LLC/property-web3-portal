import { Seo } from '@/components/Seo';
import Navigation from '@/components/Navigation';
import ProfessionalsSection from '@/components/ProfessionalsSection';
import Footer from '@/components/Footer';

const Professionals = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Professionals Directory | Accountabul"
      description="Connect with vetted real estate, legal, and compliance professionals supporting tokenized property transactions on Accountabul."
      path="/professionals"
    />
    <Navigation />
    <ProfessionalsSection />
    <Footer />
  </div>
);

export default Professionals;
