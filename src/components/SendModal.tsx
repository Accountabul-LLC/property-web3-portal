import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, ArrowLeft,
  Coins, Search, ChevronRight, Camera,
} from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { XRPLTokenHolding } from '@/hooks/useXRPLPortfolio';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  xrpBalance?: number;
  tokenHoldings?: XRPLTokenHolding[];
}

type SelectedAsset =
  | { type: 'xrp' }
  | { type: 'token'; currency: string; issuer: string; balance: number };

type Step = 'select-asset' | 'form' | 'review' | 'signing' | 'success' | 'error';

interface BuildResult {
  tx_json: Record<string, unknown>;
  fee_xrp: number;
  warnings: string[];
  // XRP-specific
  balance_xrp?: number;
  spendable_xrp?: number;
  reserve_xrp?: number;
  // Token-specific
  sender_balance?: string;
  currency?: string;
  issuer?: string;
}

const SendModal = ({ isOpen, onClose, walletAddress, xrpBalance = 0, tokenHoldings = [] }: SendModalProps) => {
  const [step, setStep] = useState<Step>('select-asset');
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [showTag, setShowTag] = useState(false);
  const [destinationTag, setDestinationTag] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const decodeCurrency = (hex: string) => {
    if (hex.length <= 3) return hex;
    try {
      return hex.replace(/0+$/, '').replace(/../g, (m: string) => String.fromCharCode(parseInt(m, 16))) || hex;
    } catch { return hex; }
  };

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokenHoldings.filter(t => t.balance > 0);
    const q = searchQuery.toLowerCase();
    return tokenHoldings.filter(t =>
      t.balance > 0 && (
        decodeCurrency(t.currency).toLowerCase().includes(q) ||
        t.issuer.toLowerCase().includes(q)
      )
    );
  }, [tokenHoldings, searchQuery]);

  const isFormValid = () => {
    if (!toAddress || !amount) return false;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return false;
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(toAddress)) return false;
    if (showTag && destinationTag) {
      const tag = Number(destinationTag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) return false;
    }
    // Check max balance
    if (selectedAsset?.type === 'token' && num > selectedAsset.balance) return false;
    return true;
  };

  const handleSelectAsset = (asset: SelectedAsset) => {
    setSelectedAsset(asset);
    setStep('form');
  };

  const handleContinue = async () => {
    if (!selectedAsset) return;
    setIsBuilding(true);
    setErrorMsg('');

    try {
      if (selectedAsset.type === 'xrp') {
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
      } else {
        const { data, error } = await supabase.functions.invoke('xrpl-build-token-payment', {
          body: {
            from_address: walletAddress,
            to_address: toAddress.trim(),
            currency: selectedAsset.currency,
            issuer: selectedAsset.issuer,
            amount: amount,
            destination_tag: showTag && destinationTag ? destinationTag : undefined,
            memo: memo.trim() || undefined,
          },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setBuildResult(data);
      }
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
      const { data, error } = await supabase.functions.invoke('xaman-send-payment', {
        body: { tx_json: buildResult.tx_json },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create signing request');

      setQrCode(data.qr_code);

      const pollInterval = setInterval(async () => {
        try {
          const { data: checkData, error: checkError } = await supabase.functions.invoke('xaman-check-payload', {
            body: { uuid: data.uuid },
          });
          if (checkError) throw checkError;
          if (checkData?.signed) {
            clearInterval(pollInterval);
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

      setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create signing request');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('select-asset');
    setSelectedAsset(null);
    setSearchQuery('');
    setToAddress('');
    setAmount('');
    setMemo('');
    setShowTag(false);
    setDestinationTag('');
    setBuildResult(null);
    setQrCode('');
    setTxHash(null);
    setErrorMsg('');
    onClose();
  };

  const handleSetMax = () => {
    if (!selectedAsset) return;
    if (selectedAsset.type === 'xrp' && buildResult) {
      setAmount(String(Math.max(0, (buildResult.spendable_xrp || 0) - 0.000012)));
    } else if (selectedAsset.type === 'token') {
      setAmount(String(selectedAsset.balance));
    }
  };

  const getAssetLabel = () => {
    if (!selectedAsset) return '';
    if (selectedAsset.type === 'xrp') return 'XRP';
    return decodeCurrency(selectedAsset.currency);
  };

  const getStepTitle = () => {
    switch (step) {
      case 'select-asset': return 'Select Asset to Send';
      case 'form': return `Send ${getAssetLabel()}`;
      case 'review': return 'Review Transaction';
      case 'signing': return 'Sign in Xaman';
      case 'success': return 'Transaction Sent';
      case 'error': return 'Transaction Failed';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        {/* ASSET SELECTION STEP */}
        {step === 'select-asset' && (
          <div className="space-y-3">
            {/* Search */}
            {tokenHoldings.length > 3 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {/* XRP option */}
                <button
                  onClick={() => handleSelectAsset({ type: 'xrp' })}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">XRP</p>
                      <p className="text-xs text-muted-foreground">Native currency</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{xrpBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Token options */}
                {filteredTokens.map((token, idx) => (
                  <button
                    key={`${token.currency}-${token.issuer}-${idx}`}
                    onClick={() => handleSelectAsset({
                      type: 'token',
                      currency: token.currency,
                      issuer: token.issuer,
                      balance: token.balance,
                    })}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                        <Coins className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{decodeCurrency(token.currency)}</p>
                        <p className="text-xs text-muted-foreground font-mono">{shortenAddress(token.issuer)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{Number(token.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}

                {filteredTokens.length === 0 && tokenHoldings.length > 0 && searchQuery && (
                  <p className="text-sm text-muted-foreground text-center py-4">No tokens match your search</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* FORM STEP */}
        {step === 'form' && selectedAsset && (
          <div className="space-y-4">
            {/* Asset badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Coins className="w-3 h-3" />
                {getAssetLabel()}
                {selectedAsset.type === 'token' && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({shortenAddress(selectedAsset.issuer)})
                  </span>
                )}
              </Badge>
              <button
                onClick={() => { setStep('select-asset'); setSelectedAsset(null); }}
                className="text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="to-address">Destination Address</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-primary"
                  onClick={() => setShowScanner(!showScanner)}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {showScanner ? 'Close Scanner' : 'Scan QR'}
                </Button>
              </div>

              {showScanner && (
                <QRScanner
                  onScan={(address) => {
                    setToAddress(address);
                    setShowScanner(false);
                  }}
                  onClose={() => setShowScanner(false)}
                />
              )}

              <Input
                id="to-address"
                placeholder="rXXXX..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount ({getAssetLabel()})</Label>
                {selectedAsset.type === 'token' && (
                  <button
                    onClick={() => setAmount(String(selectedAsset.balance))}
                    className="text-xs text-primary hover:underline"
                  >
                    MAX ({selectedAsset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })})
                  </button>
                )}
              </div>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {selectedAsset.type === 'token' && Number(amount) > selectedAsset.balance && (
                <p className="text-xs text-destructive">Amount exceeds your balance of {selectedAsset.balance}</p>
              )}
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

            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep('select-asset'); setSelectedAsset(null); }} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!isFormValid() || isBuilding}
                className="flex-1 gap-2"
              >
                {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {isBuilding ? 'Building...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && buildResult && selectedAsset && (
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
                <span className="text-muted-foreground">Asset</span>
                <span className="font-medium">
                  {getAssetLabel()}
                  {selectedAsset.type === 'token' && (
                    <span className="text-xs text-muted-foreground ml-1">({shortenAddress(selectedAsset.issuer)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{amount} {getAssetLabel()}</span>
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
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 space-y-1">
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
                {amount} {getAssetLabel()} sent to {shortenAddress(toAddress)}
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

export default SendModal;
