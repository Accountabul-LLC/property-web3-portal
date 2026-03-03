import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendXRPModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

type Step = 'form' | 'review' | 'signing' | 'success' | 'error';

interface BuildResult {
  tx_json: Record<string, unknown>;
  fee_xrp: number;
  balance_xrp: number;
  spendable_xrp: number;
  reserve_xrp: number;
  warnings: string[];
}

const SendXRPModal = ({ isOpen, onClose, walletAddress }: SendXRPModalProps) => {
  const [step, setStep] = useState<Step>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [showTag, setShowTag] = useState(false);
  const [destinationTag, setDestinationTag] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [payloadUuid, setPayloadUuid] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const isFormValid = () => {
    if (!toAddress || !amount) return false;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return false;
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(toAddress)) return false;
    if (showTag && destinationTag) {
      const tag = Number(destinationTag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) return false;
    }
    return true;
  };

  const handleContinue = async () => {
    setIsBuilding(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('xrpl-build-payment', {
        body: {
          from_address: walletAddress,
          to_address: toAddress.trim(),
          amount_xrp: amount,
          destination_tag: showTag && destinationTag ? destinationTag : undefined,
          memo: memo.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setBuildResult(data);
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to build transaction');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSign = async () => {
    if (!buildResult) return;
    setStep('signing');
    setErrorMsg('');

    try {
      // Create Xaman payload with the built tx
      const { data, error } = await supabase.functions.invoke('xaman-send-payment', {
        body: { tx_json: buildResult.tx_json },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create signing request');

      setQrCode(data.qr_code);
      setPayloadUuid(data.uuid);

      // Poll for result
      const pollInterval = setInterval(async () => {
        try {
          const { data: checkData, error: checkError } = await supabase.functions.invoke('xaman-check-payload', {
            body: { uuid: data.uuid },
          });

          if (checkError) throw checkError;

          if (checkData?.signed) {
            clearInterval(pollInterval);
            // Try to get tx hash from the payload
            setTxHash(checkData.tx_hash || null);
            setStep('success');
          } else if (checkData?.cancelled || checkData?.expired) {
            clearInterval(pollInterval);
            setErrorMsg(checkData.cancelled ? 'Transaction was rejected' : 'Signing request expired');
            setStep('error');
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (step === 'signing') {
          setErrorMsg('Signing request timed out');
          setStep('error');
        }
      }, 300000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create signing request');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('form');
    setToAddress('');
    setAmount('');
    setMemo('');
    setShowTag(false);
    setDestinationTag('');
    setBuildResult(null);
    setQrCode('');
    setPayloadUuid('');
    setTxHash(null);
    setErrorMsg('');
    onClose();
  };

  const handleSetMax = () => {
    if (buildResult) {
      setAmount(String(Math.max(0, buildResult.spendable_xrp - 0.000012)));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'form' && 'Send XRP'}
            {step === 'review' && 'Review Transaction'}
            {step === 'signing' && 'Sign in Xaman'}
            {step === 'success' && 'Transaction Sent'}
            {step === 'error' && 'Transaction Failed'}
          </DialogTitle>
        </DialogHeader>

        {/* FORM STEP */}
        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to-address">Destination Address</Label>
              <Input
                id="to-address"
                placeholder="rXXXX..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (XRP)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="0.000001"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tag-toggle" className="text-sm">Destination Tag</Label>
              <Switch id="tag-toggle" checked={showTag} onCheckedChange={setShowTag} />
            </div>

            {showTag && (
              <Input
                placeholder="Tag (integer)"
                type="number"
                value={destinationTag}
                onChange={(e) => setDestinationTag(e.target.value)}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="memo">Memo (optional)</Label>
              <Textarea
                id="memo"
                placeholder="Add a note..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={300}
                className="resize-none h-16"
              />
              <p className="text-xs text-muted-foreground text-right">{memo.length}/300</p>
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <Button
              onClick={handleContinue}
              disabled={!isFormValid() || isBuilding}
              className="w-full gap-2"
            >
              {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isBuilding ? 'Building...' : 'Continue'}
            </Button>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && buildResult && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-mono">{shortenAddress(walletAddress)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono">{shortenAddress(toAddress)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{amount} XRP</span>
              </div>
              {showTag && destinationTag && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination Tag</span>
                  <span>{destinationTag}</span>
                </div>
              )}
              {memo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memo</span>
                  <span className="truncate max-w-[180px]">{memo}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted-foreground">Network Fee</span>
                <span>{buildResult.fee_xrp} XRP</span>
              </div>
            </div>

            {buildResult.warnings.length > 0 && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3">
                {buildResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs">{w}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1 gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleSign} className="flex-1">
                Sign with Xaman
              </Button>
            </div>
          </div>
        )}

        {/* SIGNING STEP */}
        {step === 'signing' && (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm font-medium">Waiting for signature...</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Scan the QR code with your Xaman app to sign the payment
            </p>

            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="Sign Payment QR" className="w-48 h-48 border-2 border-border rounded-lg" />
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>1. Open Xaman wallet</p>
              <p>2. Scan QR code</p>
              <p>3. Review &amp; sign the payment</p>
            </div>

            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          </div>
        )}

        {/* SUCCESS STEP */}
        {step === 'success' && (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Payment Sent!</h3>
              <p className="text-sm text-muted-foreground">
                {amount} XRP sent to {shortenAddress(toAddress)}
              </p>
            </div>

            {txHash && (
              <a
                href={`https://livenet.xrpl.org/transactions/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        )}

        {/* ERROR STEP */}
        {step === 'error' && (
          <div className="space-y-4 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Transaction Failed</h3>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Close</Button>
              <Button onClick={() => setStep('form')} className="flex-1">Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendXRPModal;
