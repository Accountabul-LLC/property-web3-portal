import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = 'wss://xrplcluster.com';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useXRPLSubscription(walletAddress: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const addressRef = useRef(walletAddress);
  addressRef.current = walletAddress;

  useEffect(() => {
    if (!walletAddress) return;

    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        // Subscribe to account transactions
        ws.send(JSON.stringify({
          command: 'subscribe',
          accounts: [addressRef.current],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // A validated transaction affecting our account
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
  }, [walletAddress, queryClient]);
}
