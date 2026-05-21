import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { ShieldCheck, PieChart as PieChartIcon } from 'lucide-react';
import { TREASURY_WALLETS } from '@/config/treasuryWallets';
import TreasuryWalletCard from '@/components/treasury/TreasuryWalletCard';
import TreasuryPieChart from '@/components/treasury/TreasuryPieChart';

const Treasury = () => {
  const [selected, setSelected] = useState<string>(TREASURY_WALLETS[0]?.address ?? '');
  const selectedWallet =
    TREASURY_WALLETS.find((w) => w.address === selected) ?? TREASURY_WALLETS[0];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Transparency
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Accountabul Treasury
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Live, on-chain view of every wallet that holds our reserves. Click any slice
            to inspect that wallet's purpose, holdings, and transaction history.
          </p>
        </header>

        <Card className="p-6 mb-10">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            Treasury Allocation
          </h2>
          <TreasuryPieChart
            wallets={TREASURY_WALLETS}
            selectedAddress={selected}
            onSelect={setSelected}
          />
        </Card>

        {selectedWallet && (
          <section>
            <h2 className="text-xl font-bold mb-4">Wallet Details</h2>
            <TreasuryWalletCard key={selectedWallet.address} wallet={selectedWallet} />
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Treasury;
