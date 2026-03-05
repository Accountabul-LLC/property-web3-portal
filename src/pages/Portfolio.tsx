import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import PortfolioSection from '@/components/PortfolioSection';
import Footer from '@/components/Footer';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

const PortfolioInner = () => {
  const [searchParams] = useSearchParams();
  const { activeAddress } = useActiveWallet();

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
