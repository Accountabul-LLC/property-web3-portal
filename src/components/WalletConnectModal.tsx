import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected: (walletAddress: string) => void;
}

export function WalletConnectModal({ isOpen, onClose, onWalletConnected }: WalletConnectModalProps) {
  const [step, setStep] = useState<'select' | 'qr' | 'success' | 'error'>('select');
  const [qrCode, setQrCode] = useState<string>('');
  const [payloadUuid, setPayloadUuid] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);

  const createXamanPayload = async () => {
    try {
      setStep('qr');
      setError('');
      
      const { data, error } = await supabase.functions.invoke('xaman-create-payload', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        setQrCode(data.qr_code);
        setPayloadUuid(data.uuid);
        startPollingPayload(data.uuid);
      } else {
        throw new Error(data?.error || 'Failed to create payload');
      }
    } catch (err) {
      console.error('Error creating Xaman payload:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment request');
      setStep('error');
    }
  };

  const startPollingPayload = (uuid: string) => {
    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('xaman-check-payload', {
          body: { uuid }
        });

        if (error) throw error;

        if (data?.success) {
          if (data.signed && data.wallet_address) {
            setStep('success');
            setIsPolling(false);
            clearInterval(pollInterval);
            onWalletConnected(data.wallet_address);
          } else if (data.cancelled || data.expired) {
            setError(data.cancelled ? 'Payment request was cancelled' : 'Payment request expired');
            setStep('error');
            setIsPolling(false);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Error polling payload:', err);
        setError('Connection error while checking status');
        setStep('error');
        setIsPolling(false);
        clearInterval(pollInterval);
      }
    }, 2000);

    // Clean up polling after 5 minutes
    setTimeout(() => {
      if (isPolling) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setError('Request timed out');
        setStep('error');
      }
    }, 300000);
  };

  const handleClose = () => {
    setIsPolling(false);
    setStep('select');
    setQrCode('');
    setPayloadUuid('');
    setError('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setIsPolling(false);
      setStep('select');
      setQrCode('');
      setPayloadUuid('');
      setError('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Your Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose your preferred wallet to sign in securely
              </p>
              
              <Button 
                onClick={createXamanPayload}
                className="w-full h-12 text-base"
                size="lg"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Connect with Xaman
              </Button>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  More wallet options coming soon
                </p>
              </div>
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm font-medium">Waiting for signature...</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scan the QR code with your Xaman app
                </p>
              </div>

              {qrCode && (
                <div className="flex justify-center">
                  <img 
                    src={qrCode} 
                    alt="Xaman QR Code" 
                    className="w-48 h-48 border-2 border-border rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  1. Open your Xaman wallet app
                </p>
                <p className="text-xs text-muted-foreground">
                  2. Scan this QR code
                </p>
                <p className="text-xs text-muted-foreground">
                  3. Sign the login request
                </p>
              </div>

              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Wallet Connected!</h3>
                <p className="text-sm text-muted-foreground">
                  You've successfully signed in with your Xaman wallet
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Connection Failed</h3>
                <p className="text-sm text-muted-foreground">
                  {error || 'Something went wrong. Please try again.'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={() => setStep('select')} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}