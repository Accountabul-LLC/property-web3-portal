import React from 'react'; // portfolio page
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import PortfolioSection from '@/components/PortfolioSection';
import UnifiedWalletsOverview from '@/components/UnifiedWalletsOverview';
import Footer from '@/components/Footer';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { PortfolioLoadingSkeleton } from '@/components/PageSkeletons';

const PortfolioInner = () => {
  const [searchParams] = useSearchParams();
  const { activeAddress } = useActiveWallet();

  const viewingAccount = searchParams.get('account') || activeAddress;
  const focusTxHash = searchParams.get('tx');
  const isViewingOther = viewingAccount && viewingAccount !== activeAddress;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      {!isViewingOther && <UnifiedWalletsOverview />}
      <PortfolioSection
        overrideAddress={viewingAccount}
        isReadOnly={!!isViewingOther}
        focusTxHash={focusTxHash}
      />
    </div>
  );
};

const Portfolio = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <PortfolioLoadingSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground">Sign in to view your portfolio.</p>
          <Button onClick={() => navigate('/auth')} className="gap-2">
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <PortfolioInner />
      <Footer />
    </div>
  );
};

export default Portfolio;
