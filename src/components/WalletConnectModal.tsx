import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Wallet, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeamAccess } from "@/hooks/useTeamAccess";

type XRPLNetwork = 'mainnet' | 'testnet';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected: (walletAddress: string, accountName?: string | null) => void;
}

const NETWORK_OPTIONS: { value: XRPLNetwork; label: string; description: string }[] = [
  { value: 'mainnet', label: 'Mainnet', description: 'Production ledger' },
  { value: 'testnet', label: 'Testnet', description: 'testnet.xrpl-labs.com' },
];

export function WalletConnectModal({ isOpen, onClose, onWalletConnected }: WalletConnectModalProps) {
  const { user } = useAuth();
  const { hasAccess: isAdmin } = useTeamAccess();
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'qr' | 'success' | 'error'>('select');
  const [qrCode, setQrCode] = useState<string>('');
  const [payloadUuid, setPayloadUuid] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<XRPLNetwork>('mainnet');

  const createXamanPayload = async () => {
    try {
      setStep('qr');
      setError('');
      
      const { data, error } = await supabase.functions.invoke('xaman-create-payload', {
        body: { network: selectedNetwork }
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
            onWalletConnected(data.wallet_address, data.account_name || null);
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
    setSelectedNetwork('mainnet');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setIsPolling(false);
      setStep('select');
      setQrCode('');
      setPayloadUuid('');
      setError('');
      setSelectedNetwork('mainnet');
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
          {!user ? (
            <div className="space-y-4 text-center">
              <LogIn className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Sign In Required</h3>
                <p className="text-sm text-muted-foreground">
                  You need to sign in before connecting a wallet.
                </p>
              </div>
              <Button onClick={() => { handleClose(); navigate('/auth'); }} className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Go to Sign In
              </Button>
            </div>
          ) : (
            <>
              {step === 'select' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred wallet to connect securely
                  </p>

                  {/* Admin-only network selector */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Network (Admin)</p>
                      <div className="flex gap-2">
                        {NETWORK_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSelectedNetwork(opt.value)}
                            className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                              selectedNetwork === opt.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <div>{opt.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{opt.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                    <p className="text-xs text-muted-foreground">1. Open your Xaman wallet app</p>
                    <p className="text-xs text-muted-foreground">2. Scan this QR code</p>
                    <p className="text-xs text-muted-foreground">3. Sign the login request</p>
                  </div>

                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                </div>
              )}

              {step === 'success' && (
                <div className="space-y-4 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold">Wallet Connected!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your wallet has been linked to your account
                    </p>
                  </div>
                  <Button onClick={handleClose} className="w-full">Continue</Button>
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
                    <Button variant="outline" onClick={handleClose} className="flex-1">Close</Button>
                    <Button onClick={() => setStep('select')} className="flex-1">Try Again</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
