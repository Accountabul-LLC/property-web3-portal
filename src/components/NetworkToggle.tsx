import React from 'react';
import { useActiveWallet, type XRPLNetwork } from '@/contexts/ActiveWalletContext';
import { Globe, FlaskConical } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NetworkToggle = () => {
  const { activeNetwork, setActiveNetwork } = useActiveWallet();
  const [confirmMainnet, setConfirmMainnet] = React.useState(false);

  // Testnet is listed first because it is the safe default for this prototype.
  const options: { value: XRPLNetwork; label: string; icon: React.ReactNode }[] = [
    { value: 'testnet', label: 'Testnet', icon: <FlaskConical className="w-3 h-3" /> },
    { value: 'mainnet', label: 'Mainnet', icon: <Globe className="w-3 h-3" /> },
  ];

  const handleSelect = (value: XRPLNetwork) => {
    if (value === 'mainnet' && activeNetwork !== 'mainnet') {
      setConfirmMainnet(true);
      return;
    }
    setActiveNetwork(value);
  };

  return (
    <>
      <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5 h-8">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
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

      <AlertDialog open={confirmMainnet} onOpenChange={setConfirmMainnet}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to XRPL Mainnet?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a hackathon prototype. Mainnet uses real funds and every transaction is irreversible. Testnet is
              the recommended default. Only continue if you understand the risk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on Testnet</AlertDialogCancel>
            <AlertDialogAction onClick={() => setActiveNetwork('mainnet')}>Switch to Mainnet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NetworkToggle;
