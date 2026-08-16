import React from 'react';
import { Seo } from '@/components/Seo';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import ValuePropositionSection from '@/components/ValuePropositionSection';
import PortalOperationsSection from '@/components/PortalOperationsSection';

import NewsletterSection from '@/components/NewsletterSection';
import Footer from '@/components/Footer';
import MembershipModal from '@/components/MembershipModal';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [isMembershipModalOpen, setIsMembershipModalOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleGetStarted = () => {
    setIsMembershipModalOpen(true);
  };

  const handleExploreMarketplace = () => {
    navigate('/marketplace');
  };

  const handleMembershipPurchase = () => {
    setIsMembershipModalOpen(false);
    navigate('/pricing');
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Accountabul | XRPL Real Estate Prototype"
        description="Hackathon prototype exploring property listings, community funding campaigns, and XRPL testnet issuance with non-custodial Xaman signing."
        path="/"
      />
      <Navigation />
      <HeroSection onGetStarted={handleGetStarted} onExploreMarketplace={handleExploreMarketplace} />
      <HowItWorksSection />
      <ValuePropositionSection />
      <PortalOperationsSection />
      <NewsletterSection />
      <Footer />
      
      <MembershipModal
        isOpen={isMembershipModalOpen}
        onClose={() => setIsMembershipModalOpen(false)}
        onPurchase={handleMembershipPurchase}
      />
    </div>
  );
};

export default Index;
