import React from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MintWizard from '@/components/mint/MintWizard';

const Mint = () => {
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
