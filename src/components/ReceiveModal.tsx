import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

const ReceiveModal = ({ isOpen, onClose, walletAddress }: ReceiveModalProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({ title: 'Address copied', description: 'Wallet address copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the address manually.', variant: 'destructive' });
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
          <Badge variant="outline" className="text-xs">
            XRPL Mainnet
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
