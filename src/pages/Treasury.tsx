import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { AlertTriangle, ShieldCheck, PieChart as PieChartIcon } from 'lucide-react';
import { TREASURY_WALLETS } from '@/config/treasuryWallets';
import TreasuryWalletCard from '@/components/treasury/TreasuryWalletCard';
import TreasuryPieChart from '@/components/treasury/TreasuryPieChart';

const Treasury = () => {
  const configuredWallets = TREASURY_WALLETS.filter((wallet) => !wallet.isPlaceholder && !!wallet.address);
  const placeholderWallets = TREASURY_WALLETS.filter((wallet) => wallet.isPlaceholder);
  const [selected, setSelected] = useState<string>(configuredWallets[0]?.address ?? '');
  const selectedWallet =
    configuredWallets.find((w) => w.address === selected) ?? configuredWallets[0];

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

        {placeholderWallets.length > 0 && (
          <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Treasury setup required</p>
                <p className="text-sm text-muted-foreground">
                  One or more treasury entries are still placeholders and are hidden from the live chart.
                  Configure their real XRPL addresses in <code className="text-xs bg-muted px-1 py-0.5 rounded">src/config/treasuryWallets.ts</code>{' '}
                  before publishing them publicly.
                </p>
              </div>
            </div>
          </Card>
        )}

        {configuredWallets.length > 0 ? (
          <Card className="p-6 mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              Treasury Allocation
            </h2>
            <TreasuryPieChart
              wallets={configuredWallets}
              selectedAddress={selected}
              onSelect={setSelected}
            />
          </Card>
        ) : (
          <Card className="p-6 mb-10 border-dashed">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-lg font-bold mb-1">No configured treasury wallets yet</h2>
                <p className="text-sm text-muted-foreground">
                  Add real XRPL addresses to <code className="text-xs bg-muted px-1 py-0.5 rounded">src/config/treasuryWallets.ts</code>{' '}
                  to restore the live chart and wallet detail view.
                </p>
              </div>
            </div>
          </Card>
        )}

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
