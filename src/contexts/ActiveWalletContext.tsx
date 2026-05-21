// ActiveWalletContext — manages multi-wallet state, DB persistence, and audit logging
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { toast } from 'sonner';

/** Supported XRPL network targets */
export type XRPLNetwork = 'mainnet' | 'testnet';

export interface ConnectedWallet {
  id: string;
  address: string;
  label: string;
  xamanName: string | null;
  provider: string;
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
  addWallet: (address: string, label?: string, xamanName?: string | null, provider?: string, walletSecret?: string | null) => void;
  removeWallet: (address: string) => void;
  renameWallet: (address: string, newLabel: string) => void;
  disconnectAll: () => void;
  getWalletSecret: (address: string | null | undefined) => string | null;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  onWalletConnected: (address: string, xamanName?: string | null) => void;
  walletsLoading: boolean;
}

const ACTIVE_KEY = 'accountabul_active_wallet';
const NETWORK_KEY = 'accountabul_active_network';
const WALLET_SECRET_PREFIX = 'accountabul_wallet_secret_';

function loadActiveAddress(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveAddress(addr: string | null) {
  if (addr) localStorage.setItem(ACTIVE_KEY, addr);
  else localStorage.removeItem(ACTIVE_KEY);
}

function walletSecretKey(address: string) {
  return `${WALLET_SECRET_PREFIX}${address}`;
}

function saveWalletSecret(address: string, secret: string | null | undefined) {
  const key = walletSecretKey(address);
  if (secret) {
    sessionStorage.setItem(key, secret);
  } else {
    sessionStorage.removeItem(key);
  }
}

function loadWalletSecret(address: string) {
  return sessionStorage.getItem(walletSecretKey(address));
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
  const [activeNetwork, setActiveNetworkState] = useState<XRPLNetwork>(() => {
    const saved = localStorage.getItem(NETWORK_KEY);
    return saved === 'testnet' ? saved : 'mainnet';
  });
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const prevActiveRef = useRef<string | null>(activeAddress);
  const walletsRef = useRef<ConnectedWallet[]>([]);

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // Load wallets from DB when user authenticates
  useEffect(() => {
    if (!user) {
      walletsRef.current.forEach(w => saveWalletSecret(w.address, null));
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

  // Network is now a viewing context, not a wallet filter — show all active wallets
  const filteredWallets = wallets;
  const activeWallet = wallets.find(w => w.address === activeAddress) || null;
  const isConnected = !!activeWallet;

  const setActiveNetwork = useCallback((network: XRPLNetwork) => {
    setActiveNetworkState(network);
    localStorage.setItem(NETWORK_KEY, network);
    // No wallet switching — same wallet, different network view
  }, []);

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

  const addWallet = useCallback(async (address: string, label?: string, xamanName?: string | null, provider?: string, walletSecret?: string | null) => {
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

    saveWalletSecret(address, walletSecret);

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

    saveWalletSecret(address, null);

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
    wallets.forEach(w => saveWalletSecret(w.address, null));

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

  const getWalletSecret = useCallback((address: string | null | undefined) => {
    if (!address) return null;
    return loadWalletSecret(address);
  }, []);

  const onWalletConnected = useCallback((address: string, xamanName?: string | null) => {
    addWallet(address, undefined, xamanName);
    setConnectModalOpen(false);
    const displayName = xamanName || `${address.slice(0, 6)}...${address.slice(-4)}`;
    toast.success(`✅ Wallet Connected — Signed in as ${displayName}`);
  }, [addWallet]);

  // 30-minute inactivity timeout: clears auth session + wallet context
  const handleInactivityTimeout = useCallback(() => {
    walletsRef.current.forEach(w => saveWalletSecret(w.address, null));
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
      filteredWallets,
      activeWallet,
      activeAddress,
      activeNetwork,
      setActiveNetwork,
      isConnected,
      setActiveWallet,
      addWallet,
      removeWallet,
      renameWallet,
      disconnectAll,
      getWalletSecret,
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
