import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const containerId = 'qr-scanner-container';
  const [error, setError] = useState('');

  const handleScan = useCallback((decodedText: string) => {
    let address = decodedText.trim();
    if (address.startsWith('xrpl:')) address = address.replace('xrpl:', '').split('?')[0];
    if (address.startsWith('ripple:')) address = address.replace('ripple:', '').split('?')[0];
    
    // Stop scanner before calling onScan
    if (scannerRef.current && isRunningRef.current) {
      isRunningRef.current = false;
      scannerRef.current.stop().catch(() => {});
    }
    onScan(address);
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        () => {} // ignore no-QR frames
      )
      .then(() => {
        isRunningRef.current = true;
      })
      .catch((err) => {
        console.error('QR Scanner start error:', err);
        setError('Could not access camera. Please check permissions.');
        isRunningRef.current = false;
      });

    return () => {
      if (scannerRef.current && isRunningRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [handleScan]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Scan QR Code</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div
        id={containerId}
        className="w-full rounded-lg overflow-hidden border border-border"
        style={{ minHeight: 250 }}
      />
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Point your camera at an XRPL wallet QR code
      </p>
    </div>
  );
};

export default QRScanner;
