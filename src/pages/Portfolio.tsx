import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import PortfolioSection from '@/components/PortfolioSection';
import Footer from '@/components/Footer';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';

const PortfolioInner = () => {
  const [searchParams] = useSearchParams();
  const { activeAddress } = useActiveWallet();

  // Support ?account=rXXX for shareable portfolio URLs
  const viewingAccount = searchParams.get('account') || activeAddress;
  const isViewingOther = viewingAccount && viewingAccount !== activeAddress;

  return (
    <PortfolioSection
      overrideAddress={viewingAccount}
      isReadOnly={!!isViewingOther}
    />
  );
};

const Portfolio = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PortfolioInner />
      <Footer />
    </div>
  );
};

export default Portfolio;
