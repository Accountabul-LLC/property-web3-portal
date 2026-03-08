import React from 'react';
import { useActiveWallet, type XRPLNetwork } from '@/contexts/ActiveWalletContext';
import { Globe, FlaskConical } from 'lucide-react';

const NetworkToggle = () => {
  const { activeNetwork, setActiveNetwork } = useActiveWallet();

  const options: { value: XRPLNetwork; label: string; icon: React.ReactNode }[] = [
    { value: 'mainnet', label: 'Mainnet', icon: <Globe className="w-3 h-3" /> },
    { value: 'testnet', label: 'Testnet', icon: <FlaskConical className="w-3 h-3" /> },
  ];

  return (
    <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5 h-8">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setActiveNetwork(opt.value)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
            activeNetwork === opt.value
              ? opt.value === 'testnet'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.icon}
          <span className="hidden xl:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

export default NetworkToggle;
