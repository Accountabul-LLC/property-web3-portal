// ActiveWalletContext — manages multi-wallet state, DB persistence, and audit logging
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { toast } from 'sonner';

/** Supported XRPL network targets */
export type XRPLNetwork = 'mainnet' | 'testnet' | 'devnet';

export interface ConnectedWallet {
  id: string;
  address: string;
  label: string;
  xamanName: string | null;
  provider: string;
  network: XRPLNetwork;
  connectedAt: string;
  lastUsedAt: string;
  status: string;
}

interface ActiveWalletContextType {
  wallets: ConnectedWallet[];
  filteredWallets: ConnectedWallet[];
  activeWallet: ConnectedWallet | null;
  activeAddress: string | null;
  activeNetwork: XRPLNetwork;
  setActiveNetwork: (network: XRPLNetwork) => void;
  isConnected: boolean;
  setActiveWallet: (address: string) => void;
  addWallet: (address: string, label?: string, xamanName?: string | null, provider?: string, walletSecret?: string | null, network?: XRPLNetwork) => void;
  removeWallet: (address: string) => void;
  renameWallet: (address: string, newLabel: string) => void;
  disconnectAll: () => void;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  onWalletConnected: (address: string, xamanName?: string | null, network?: XRPLNetwork) => void;
  walletsLoading: boolean;
}

const ACTIVE_KEY = 'accountabul_active_wallet';

function loadActiveAddress(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveAddress(addr: string | null) {
  if (addr) localStorage.setItem(ACTIVE_KEY, addr);
  else localStorage.removeItem(ACTIVE_KEY);
}

// Fire-and-forget audit log
function logAuditEvent(walletAddress: string, eventType: string, userId?: string, metadata?: Record<string, unknown>) {
  supabase.functions.invoke('wallet-audit-log', {
    body: { wallet_address: walletAddress, event_type: eventType, user_id: userId, metadata },
  }).catch(err => console.warn('Audit log failed (non-blocking):', err));
}

const ActiveWalletContext = createContext<ActiveWalletContextType | null>(null);

export function ActiveWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<ConnectedWallet[]>([]);
  const [activeAddress, setActiveAddressState] = useState<string | null>(() => loadActiveAddress());
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const prevActiveRef = useRef<string | null>(activeAddress);

  // Load wallets from DB when user authenticates
  useEffect(() => {
    if (!user) {
      setWallets([]);
      setActiveAddressState(null);
      saveActiveAddress(null);
      return;
    }

    const fetchWallets = async () => {
      setWalletsLoading(true);
      const { data, error } = await supabase
        .from('user_wallets_safe')
        .select('*')
        .eq('status', 'active')
        .order('last_seen_at', { ascending: false });

      if (error) {
        console.error('Failed to load wallets:', error);
        setWalletsLoading(false);
        return;
      }

      const mapped: ConnectedWallet[] = (data || []).map((w: any) => ({
        id: w.id,
        address: w.wallet_address,
        label: w.label || w.xaman_account_name || `Wallet`,
        xamanName: w.xaman_account_name,
        provider: w.provider || 'xaman',
        network: (w.network === 'testnet' ? 'testnet' : w.network === 'devnet' ? 'devnet' : 'mainnet') as XRPLNetwork,
        connectedAt: w.created_at,
        lastUsedAt: w.last_seen_at,
        status: w.status,
      }));

      setWallets(mapped);

      // Reconcile active address
      const savedActive = loadActiveAddress();
      if (savedActive && mapped.find(w => w.address === savedActive)) {
        setActiveAddressState(savedActive);
      } else if (mapped.length > 0) {
        setActiveAddressState(mapped[0].address);
        saveActiveAddress(mapped[0].address);
      } else {
        setActiveAddressState(null);
        saveActiveAddress(null);
      }

      setWalletsLoading(false);
    };

    fetchWallets();
  }, [user]);

  // Clean up old localStorage migration data
  useEffect(() => {
    localStorage.removeItem('accountabul_wallets');
    localStorage.removeItem('wallet_address');
  }, []);

  const activeWallet = wallets.find(w => w.address === activeAddress) || null;
  const isConnected = !!activeWallet;

  const setActiveWallet = useCallback((address: string) => {
    const prev = prevActiveRef.current;
    setActiveAddressState(address);
    saveActiveAddress(address);

    // Update last_seen_at in DB
    supabase
      .from('user_wallets')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('wallet_address', address)
      .then(() => {});

    if (prev && prev !== address && user) {
      logAuditEvent(prev, 'switch_from', user.id, { switched_to: address });
      logAuditEvent(address, 'switch_to', user.id, { switched_from: prev });
    }
    prevActiveRef.current = address;
  }, [user]);

  const addWallet = useCallback(async (address: string, label?: string, xamanName?: string | null, provider?: string, walletSecret?: string | null, network?: XRPLNetwork) => {
    if (!user) return;

    // Upsert into user_wallets
    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      wallet_address: address,
      label: label || xamanName || `Wallet`,
      xaman_account_name: xamanName || null,
      status: 'active',
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      ...(provider ? { provider } : {}),
      ...(walletSecret ? { wallet_secret: walletSecret } : {}),
      ...(network ? { network } : {}),
    };

    const { data, error } = await supabase
      .from('user_wallets')
      .upsert(upsertData as any, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (error) {
      console.error('Failed to add wallet:', error);
      return;
    }

    // Refresh wallet list
    const { data: allWallets } = await supabase
      .from('user_wallets_safe')
      .select('*')
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false });

    const mapped: ConnectedWallet[] = (allWallets || []).map((w: any) => ({
      id: w.id,
      address: w.wallet_address,
      label: w.label || w.xaman_account_name || `Wallet`,
      xamanName: w.xaman_account_name,
      provider: w.provider || 'xaman',
      network: (w.network === 'testnet' ? 'testnet' : w.network === 'devnet' ? 'devnet' : 'mainnet') as XRPLNetwork,
      connectedAt: w.created_at,
      lastUsedAt: w.last_seen_at,
      status: w.status,
    }));

    setWallets(mapped);
    setActiveAddressState(address);
    saveActiveAddress(address);
    prevActiveRef.current = address;

    logAuditEvent(address, 'connect', user.id, { label: label || null, xaman_name: xamanName || null, provider: provider || 'xaman' });
  }, [user]);

  const removeWallet = useCallback(async (address: string) => {
    if (!user) return;

    logAuditEvent(address, 'disconnect', user.id);

    await supabase
      .from('user_wallets')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('wallet_address', address)
      .eq('user_id', user.id);

    setWallets(prev => {
      const updated = prev.filter(w => w.address !== address);
      if (activeAddress === address) {
        const fallback = updated.length > 0 ? updated[0].address : null;
        setActiveAddressState(fallback);
        saveActiveAddress(fallback);
        prevActiveRef.current = fallback;
      }
      return updated;
    });
  }, [activeAddress, user]);

  const renameWallet = useCallback(async (address: string, newLabel: string) => {
    if (!user) return;

    await supabase
      .from('user_wallets')
      .update({ label: newLabel })
      .eq('wallet_address', address)
      .eq('user_id', user.id);

    setWallets(prev =>
      prev.map(w => w.address === address ? { ...w, label: newLabel } : w)
    );
  }, [user]);

  const disconnectAll = useCallback(async () => {
    if (!user) return;

    wallets.forEach(w => logAuditEvent(w.address, 'disconnect_all', user.id));

    await supabase
      .from('user_wallets')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active');

    setWallets([]);
    setActiveAddressState(null);
    saveActiveAddress(null);
    prevActiveRef.current = null;
  }, [wallets, user]);

  const onWalletConnected = useCallback((address: string, xamanName?: string | null, network?: XRPLNetwork) => {
    addWallet(address, undefined, xamanName, undefined, undefined, network);
    setConnectModalOpen(false);
    const displayName = xamanName || `${address.slice(0, 6)}...${address.slice(-4)}`;
    toast.success(`✅ Wallet Connected — Signed in as ${displayName}`);
  }, [addWallet]);

  // 30-minute inactivity timeout: clears auth session + wallet context
  const handleInactivityTimeout = useCallback(() => {
    setWallets([]);
    setActiveAddressState(null);
    saveActiveAddress(null);
    prevActiveRef.current = null;
    toast.info('Session expired due to inactivity. Please sign in again.');
  }, []);

  useInactivityTimeout(handleInactivityTimeout);

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
      walletsLoading,
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
