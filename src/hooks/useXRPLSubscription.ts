import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const MAINNET_WS = ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com'];
const TESTNET_WS = ['wss://s.altnet.rippletest.net:51233'];
const DEVNET_WS = ['wss://s.devnet.rippletest.net:51233'];
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useXRPLSubscription(walletAddress: string | null, network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet') {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const addressRef = useRef(walletAddress);
  const endpointIndex = useRef(0);
  addressRef.current = walletAddress;

  useEffect(() => {
    if (!walletAddress) return;

    let disposed = false;
    const endpoints = network === 'devnet' ? DEVNET_WS : network === 'testnet' ? TESTNET_WS : MAINNET_WS;

    const connect = () => {
      if (disposed) return;

      const wsUrl = endpoints[endpointIndex.current % endpoints.length];
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        ws.send(JSON.stringify({
          command: 'subscribe',
          accounts: [addressRef.current],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transaction' && msg.validated === true) {
            queryClient.invalidateQueries({
              queryKey: ['xrpl_portfolio', addressRef.current],
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (disposed) return;
        // Cycle to next endpoint on failure
        endpointIndex.current++;
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current),
          RECONNECT_MAX_MS
        );
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({
            command: 'unsubscribe',
            accounts: [walletAddress],
          }));
        } catch { /* already closed */ }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [walletAddress, network, queryClient]);
}
