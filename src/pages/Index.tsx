import React from 'react';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import TokenizeSection from '@/components/TokenizeSection';
import PortfolioSection from '@/components/PortfolioSection';
import MarketplaceSection from '@/components/MarketplaceSection';

const Index = () => {
  const [currentSection, setCurrentSection] = React.useState('home');

  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
  };

  const handleGetStarted = () => {
    setCurrentSection('tokenize');
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'home':
        return <HeroSection onGetStarted={handleGetStarted} />;
      case 'tokenize':
        return <TokenizeSection />;
      case 'portfolio':
        return <PortfolioSection />;
      case 'marketplace':
        return <MarketplaceSection />;
      default:
        return <HeroSection onGetStarted={handleGetStarted} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        onSectionChange={handleSectionChange} 
        currentSection={currentSection} 
      />
      {renderCurrentSection()}
    </div>
  );
};

export default Index;
