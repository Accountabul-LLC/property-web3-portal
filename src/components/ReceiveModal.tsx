import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  network?: 'mainnet' | 'testnet';
}

const ReceiveModal = ({ isOpen, onClose, walletAddress, network = 'mainnet' }: ReceiveModalProps) => {
  const [copied, setCopied] = useState(false);
  

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed - please copy the address manually');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Receive on XRPL</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={walletAddress}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Address */}
          <div className="w-full">
            <p className="text-xs text-muted-foreground text-center mb-2">Your XRPL Address</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <code className="flex-1 text-xs font-mono break-all text-foreground">
                {walletAddress}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-8 w-8"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Network Badge */}
          <Badge variant={network === 'testnet' ? 'secondary' : 'outline'} className="text-xs">
            XRPL {network === 'testnet' ? 'Testnet' : 'Mainnet'}
          </Badge>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3 w-full">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-xs">
              Only send XRP or XRPL-based tokens to this address. Sending assets from other networks will result in permanent loss.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiveModal;
