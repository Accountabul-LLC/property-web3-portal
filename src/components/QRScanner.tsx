import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-scanner-container';
  const [error, setError] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract r-address from QR (could be raw address or URI)
          let address = decodedText.trim();
          // Handle xrpl: URI format
          if (address.startsWith('xrpl:')) {
            address = address.replace('xrpl:', '').split('?')[0];
          }
          // Handle ripple: URI format  
          if (address.startsWith('ripple:')) {
            address = address.replace('ripple:', '').split('?')[0];
          }
          if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
            onScan(address);
          } else {
            // Try raw text as-is
            onScan(decodedText.trim());
          }
          scanner.stop().catch(() => {});
        },
        () => {} // ignore scan failures (no QR in frame)
      )
      .catch((err) => {
        console.error('QR Scanner error:', err);
        setError('Could not access camera. Please check permissions.');
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan]);

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
