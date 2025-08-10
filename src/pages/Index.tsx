import React from 'react';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import TokenizeSection from '@/components/TokenizeSection';
import PortfolioSection from '@/components/PortfolioSection';
import MarketplaceSection from '@/components/MarketplaceSection';
import PropertyListingsSection from '@/components/PropertyListingsSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import ValuePropositionSection from '@/components/ValuePropositionSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import NewsletterSection from '@/components/NewsletterSection';
import Footer from '@/components/Footer';
import MembershipModal from '@/components/MembershipModal';
import AIAgentMarketplaceSection from '@/components/AIAgentMarketplaceSection';

const Index = () => {
  const [currentSection, setCurrentSection] = React.useState('home');
  const [isMembershipModalOpen, setIsMembershipModalOpen] = React.useState(false);
  const [isWalletConnected, setIsWalletConnected] = React.useState(false);
  const [hasMembership, setHasMembership] = React.useState(false);

  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
  };

  const checkMembershipAccess = () => {
    if (!isWalletConnected) {
      // In real app, trigger wallet connect
      alert('Please connect your wallet first');
      return false;
    }
    if (!hasMembership) {
      setIsMembershipModalOpen(true);
      return false;
    }
    return true;
  };

  const handleGetStarted = () => {
    if (checkMembershipAccess()) {
      setCurrentSection('tokenize');
    }
  };

  const handleMembershipPurchase = () => {
    // In real app, trigger NFT minting/payment flow
    setHasMembership(true);
    setIsMembershipModalOpen(false);
    setCurrentSection('tokenize');
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'home':
        return (
          <>
            <HeroSection onGetStarted={handleGetStarted} />
            <HowItWorksSection />
            <ValuePropositionSection />
            <TestimonialsSection />
            <NewsletterSection />
          </>
        );
      case 'tokenize':
        return <TokenizeSection />;
      case 'portfolio':
        return <PortfolioSection />;
      case 'marketplace':
        return <PropertyListingsSection />;
      case 'professionals':
        return <MarketplaceSection />;
      case 'ai-agents':
        return <AIAgentMarketplaceSection />;
      default:
        return (
          <>
            <HeroSection onGetStarted={handleGetStarted} />
            <HowItWorksSection />
            <ValuePropositionSection />
            <TestimonialsSection />
            <NewsletterSection />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        onSectionChange={handleSectionChange} 
        currentSection={currentSection} 
      />
      {renderCurrentSection()}
      {currentSection === 'home' && <Footer />}
      
      <MembershipModal
        isOpen={isMembershipModalOpen}
        onClose={() => setIsMembershipModalOpen(false)}
        onPurchase={handleMembershipPurchase}
      />
    </div>
  );
};

export default Index;
