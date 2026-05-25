import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const MAINNET_WS = ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com'];
const TESTNET_WS = ['wss://s.altnet.rippletest.net:51233'];
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export interface XRPLTransactionEvent {
  tx: any;
  meta: any;
  validated: boolean;
}

export function useXRPLSubscription(
  walletAddress: string | null,
  network: 'mainnet' | 'testnet' = 'mainnet',
  onTransaction?: (evt: XRPLTransactionEvent) => void,
) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const addressRef = useRef(walletAddress);
  const endpointIndex = useRef(0);
  const onTxRef = useRef(onTransaction);
  addressRef.current = walletAddress;
  onTxRef.current = onTransaction;

  useEffect(() => {
    if (!walletAddress) return;

    let disposed = false;
    const endpoints = network === 'testnet' ? TESTNET_WS : MAINNET_WS;

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
            if (onTxRef.current) {
              const tx = msg.transaction || msg.tx_json || msg.tx;
              // Ensure hash is present on tx object for downstream use
              if (tx && !tx.hash && msg.hash) tx.hash = msg.hash;
              onTxRef.current({ tx, meta: msg.meta, validated: true });
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (disposed) return;
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
