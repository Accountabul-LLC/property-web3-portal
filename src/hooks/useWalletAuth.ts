import { useState, useEffect } from 'react';

interface WalletAuthState {
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => void;
  disconnect: () => void;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  onWalletConnected: (address: string) => void;
}

export function useWalletAuth(): WalletAuthState {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load wallet session from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('wallet_address');
    if (savedAddress) {
      setWalletAddress(savedAddress);
      setIsConnected(true);
    }
  }, []);

  const connect = () => {
    setIsModalOpen(true);
  };

  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    setIsConnected(true);
    localStorage.setItem('wallet_address', address);
    setIsModalOpen(false);
  };

  const disconnect = () => {
    setWalletAddress(null);
    setIsConnected(false);
    localStorage.removeItem('wallet_address');
  };

  const setModalOpen = (open: boolean) => {
    setIsModalOpen(open);
  };

  return {
    isConnected,
    walletAddress,
    connect,
    disconnect,
    isModalOpen,
    setModalOpen,
    onWalletConnected: handleWalletConnected
  };
}