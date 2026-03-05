import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet, ChevronDown, Plus, X, Check, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useActiveWallet, type ConnectedWallet } from '@/contexts/ActiveWalletContext';

interface WalletSelectorProps {
  compact?: boolean;
}

const WalletSelector = ({ compact = false }: WalletSelectorProps) => {
  const {
    wallets, activeWallet, activeAddress,
    setActiveWallet, removeWallet, renameWallet,
    openConnectModal, disconnectAll,
  } = useActiveWallet();

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleStartRename = (w: ConnectedWallet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddress(w.address);
    setEditLabel(w.label);
  };

  const handleSaveRename = (address: string) => {
    if (editLabel.trim()) {
      renameWallet(address, editLabel.trim());
    }
    setEditingAddress(null);
  };

  const handleRemove = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeWallet(address);
    if (wallets.length <= 1) setIsOpen(false);
  };

  if (!activeWallet) {
    return null; // Connect button is handled by Navigation
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/20 bg-primary/10 hover:bg-primary/15 transition-colors cursor-pointer ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <Wallet className={compact ? 'w-3.5 h-3.5 text-primary' : 'w-4 h-4 text-primary'} />
          <span
            className="font-medium text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/portfolio');
            }}
          >
            {activeWallet.label || activeWallet.xamanName || shortenAddress(activeAddress!)}
          </span>
          {wallets.length > 1 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
              {wallets.length}
            </Badge>
          )}
          <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-primary/60`} />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-2" align="end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Your Wallets</p>

          {wallets.map((w) => (
            <div key={w.address}>
              {editingAddress === w.address ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(w.address)}
                    className="h-7 text-xs flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSaveRename(w.address)}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setActiveWallet(w.address); setIsOpen(false); navigate('/portfolio'); }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors ${
                    w.address === activeAddress
                      ? 'bg-primary/10 text-foreground'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {w.address === activeAddress && (
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <p className="text-xs font-medium truncate">{w.label}</p>
                      {w.xamanName && w.xamanName !== w.label && (
                        <p className="text-[10px] text-primary/70 truncate">{w.xamanName}</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground">{shortenAddress(w.address)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-50 hover:opacity-100"
                      onClick={(e) => handleStartRename(w, e)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-50 hover:opacity-100 hover:text-destructive"
                      onClick={(e) => handleRemove(w.address, e)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-border pt-1 mt-1 space-y-1">
            <button
              onClick={() => { openConnectModal(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Wallet</span>
            </button>

            {wallets.length > 0 && (
              <button
                onClick={() => { disconnectAll(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Disconnect All</span>
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default WalletSelector;
