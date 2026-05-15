import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { ShieldCheck } from 'lucide-react';
import { TREASURY_WALLETS } from '@/config/treasuryWallets';
import TreasuryWalletCard from '@/components/treasury/TreasuryWalletCard';

const Treasury = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
            Live, on-chain view of the wallets that hold our reserves. Every balance and
            transaction below is verifiable directly on the XRP Ledger.
          </p>
        </header>

        <div className="space-y-12">
          {TREASURY_WALLETS.map((w) => (
            <TreasuryWalletCard key={w.address} wallet={w} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Treasury;
