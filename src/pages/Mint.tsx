import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MintWizard from '@/components/mint/MintWizard';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Mint = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // SEC-006: Auth guard — redirect unauthenticated users before rendering any UI
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <MintWizard />
      </div>
      <Footer />
    </div>
  );
};

export default Mint;
