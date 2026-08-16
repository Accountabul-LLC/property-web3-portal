import React from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Droplets } from 'lucide-react';
import PrototypeNotice from '@/components/PrototypeNotice';

const Pools = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Droplets className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold">Liquidity Pools</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Planned feature: provide liquidity to XRP Ledger AMM pools for supported assets. This page is a
            placeholder while the flow is designed.
          </p>
        </header>

        <PrototypeNotice className="mb-6">
          Liquidity pools are not implemented. Nothing on this page connects to an AMM, and no fees can be earned.
        </PrototypeNotice>

        <Card className="p-8 text-center border-dashed">
          <Droplets className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Pools coming soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We're wiring up AMM pool creation, deposits, and withdrawals on the XRP Ledger.
            This page will list active pools, your LP positions, and fee earnings.
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Pools;
