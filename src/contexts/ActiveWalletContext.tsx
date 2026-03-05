import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectedWallet {
  address: string;
  label: string;
  xamanName: string | null;
  connectedAt: string;
  lastUsedAt: string;
}

interface ActiveWalletContextType {
  wallets: ConnectedWallet[];
  activeWallet: ConnectedWallet | null;
  activeAddress: string | null;
  isConnected: boolean;
  setActiveWallet: (address: string) => void;
  addWallet: (address: string, label?: string, xamanName?: string | null) => void;
  removeWallet: (address: string) => void;
  renameWallet: (address: string, newLabel: string) => void;
  disconnectAll: () => void;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  onWalletConnected: (address: string, xamanName?: string | null) => void;
}

const STORAGE_KEY = 'accountabul_wallets';
const ACTIVE_KEY = 'accountabul_active_wallet';

function loadWallets(): ConnectedWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveWallets(wallets: ConnectedWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

function loadActiveAddress(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveAddress(addr: string | null) {
  if (addr) localStorage.setItem(ACTIVE_KEY, addr);
  else localStorage.removeItem(ACTIVE_KEY);
}

// Fire-and-forget audit log — never blocks UI
function logAuditEvent(walletAddress: string, eventType: string, metadata?: Record<string, unknown>) {
  supabase.functions.invoke('wallet-audit-log', {
    body: { wallet_address: walletAddress, event_type: eventType, metadata },
  }).catch(err => console.warn('Audit log failed (non-blocking):', err));
}

const ActiveWalletContext = createContext<ActiveWalletContextType | null>(null);

export function ActiveWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<ConnectedWallet[]>(() => loadWallets());
  const [activeAddress, setActiveAddressState] = useState<string | null>(() => loadActiveAddress());
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const prevActiveRef = useRef<string | null>(activeAddress);

  // Migrate from old single-wallet localStorage
  useEffect(() => {
    const oldAddr = localStorage.getItem('wallet_address');
    if (oldAddr && wallets.length === 0) {
      const w: ConnectedWallet = {
        address: oldAddr,
        label: 'Primary',
        xamanName: null,
        connectedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };
      setWallets([w]);
      setActiveAddressState(oldAddr);
      saveWallets([w]);
      saveActiveAddress(oldAddr);
      localStorage.removeItem('wallet_address');
    }
  }, []);

  // Reconcile: if active address no longer in wallet list, fall back
  useEffect(() => {
    if (activeAddress && !wallets.find(w => w.address === activeAddress)) {
      const fallback = wallets.length > 0 ? wallets[0].address : null;
      setActiveAddressState(fallback);
      saveActiveAddress(fallback);
    }
  }, [wallets, activeAddress]);

  const activeWallet = wallets.find(w => w.address === activeAddress) || null;
  const isConnected = !!activeWallet;

  const setActiveWallet = useCallback((address: string) => {
    const now = new Date().toISOString();
    const prev = prevActiveRef.current;

    setWallets(prevWallets => {
      const updated = prevWallets.map(w =>
        w.address === address ? { ...w, lastUsedAt: now } : w
      );
      saveWallets(updated);
      return updated;
    });
    setActiveAddressState(address);
    saveActiveAddress(address);

    // Audit: log switch events
    if (prev && prev !== address) {
      logAuditEvent(prev, 'switch_from', { switched_to: address });
      logAuditEvent(address, 'switch_to', { switched_from: prev });
    }
    prevActiveRef.current = address;
  }, []);

  const addWallet = useCallback((address: string, label?: string, xamanName?: string | null) => {
    const now = new Date().toISOString();
    let isNew = false;

    setWallets(prev => {
      const existing = prev.find(w => w.address === address);
      if (existing) {
        const updated = prev.map(w =>
          w.address === address
            ? { ...w, lastUsedAt: now, xamanName: xamanName ?? w.xamanName }
            : w
        );
        saveWallets(updated);
        return updated;
      }
      isNew = true;
      const newWallet: ConnectedWallet = {
        address,
        label: label || xamanName || `Wallet ${prev.length + 1}`,
        xamanName: xamanName || null,
        connectedAt: now,
        lastUsedAt: now,
      };
      const updated = [...prev, newWallet];
      saveWallets(updated);
      return updated;
    });
    setActiveAddressState(address);
    saveActiveAddress(address);
    prevActiveRef.current = address;

    // Audit: log connect event
    logAuditEvent(address, 'connect', { is_new: isNew, label: label || null, xaman_name: xamanName || null });
  }, []);

  const removeWallet = useCallback((address: string) => {
    // Audit: log disconnect before removing
    logAuditEvent(address, 'disconnect');

    setWallets(prev => {
      const updated = prev.filter(w => w.address !== address);
      saveWallets(updated);
      if (activeAddress === address) {
        const fallback = updated.length > 0 ? updated[0].address : null;
        setActiveAddressState(fallback);
        saveActiveAddress(fallback);
        prevActiveRef.current = fallback;
      }
      return updated;
    });
  }, [activeAddress]);

  const renameWallet = useCallback((address: string, newLabel: string) => {
    setWallets(prev => {
      const updated = prev.map(w =>
        w.address === address ? { ...w, label: newLabel } : w
      );
      saveWallets(updated);
      return updated;
    });
  }, []);

  const disconnectAll = useCallback(() => {
    // Audit: log disconnect_all for each wallet
    wallets.forEach(w => logAuditEvent(w.address, 'disconnect_all'));

    setWallets([]);
    setActiveAddressState(null);
    saveWallets([]);
    saveActiveAddress(null);
    prevActiveRef.current = null;
  }, [wallets]);

  const onWalletConnected = useCallback((address: string, xamanName?: string | null) => {
    addWallet(address, undefined, xamanName);
    setConnectModalOpen(false);
  }, [addWallet]);

  return (
    <ActiveWalletContext.Provider value={{
      wallets,
      activeWallet,
      activeAddress,
      isConnected,
      setActiveWallet,
      addWallet,
      removeWallet,
      renameWallet,
      disconnectAll,
      isConnectModalOpen,
      openConnectModal: () => setConnectModalOpen(true),
      closeConnectModal: () => setConnectModalOpen(false),
      onWalletConnected,
    }}>
      {children}
    </ActiveWalletContext.Provider>
  );
}

export function useActiveWallet() {
  const ctx = useContext(ActiveWalletContext);
  if (!ctx) throw new Error('useActiveWallet must be used within ActiveWalletProvider');
  return ctx;
}
