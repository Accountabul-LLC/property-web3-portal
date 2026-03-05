import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Coins, Image, Layers, ArrowLeft, ArrowRight, Loader2, FlaskConical, QrCode, AlertTriangle, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import NFTForm, { type NFTParams } from './NFTForm';
import MPTForm, { type MPTParams } from './MPTForm';
import IOUForm, { type IOUParams } from './IOUForm';
import MintStatus from './MintStatus';

type TokenType = 'nft' | 'mpt' | 'iou';
type Network = 'testnet' | 'mainnet';
type MintStep = 'type' | 'form' | 'review';

const TOKEN_INFO: Record<TokenType, { label: string; desc: string; icon: React.ReactNode }> = {
  nft: { label: 'NFT (XLS-20)', desc: 'Mint a non-fungible token', icon: <Image className="w-5 h-5" /> },
  mpt: { label: 'MPT', desc: 'Multi-Purpose Token issuance', icon: <Layers className="w-5 h-5" /> },
  iou: { label: 'IOU (Trust Line)', desc: 'Issue a fungible trust line token', icon: <Coins className="w-5 h-5" /> },
};

const defaultNFT: NFTParams = { uri: '', flags: { transferable: true, burnable: false, onlyXRP: false } };
const defaultMPT: MPTParams = { name: '', description: '', max_amount: '', asset_scale: 0, transfer_fee: 0, flags: { can_lock: false, require_auth: false, can_escrow: false, can_trade: false, can_transfer: true, can_clawback: false }, property_address: '', city: '', state: '', zip: '', country: 'United States', property_type: '', owner_name: '', owner_email: '', estimated_value: '', bedrooms: '', bathrooms: '', square_feet: '', year_built: '' };
const defaultIOU: IOUParams = { currency_code: '', amount: '', destination: '' };

const MintWizard: React.FC = () => {
  const { activeAddress, activeWallet, isConnected, addWallet } = useActiveWallet();
  const { user } = useAuth();

  const [step, setStep] = useState<MintStep>('type');
  const [tokenType, setTokenType] = useState<TokenType>('nft');
  const [network, setNetwork] = useState<Network>(activeWallet?.network === 'testnet' ? 'testnet' : 'testnet');

  const [nftParams, setNftParams] = useState<NFTParams>(defaultNFT);
  const [mptParams, setMptParams] = useState<MPTParams>(defaultMPT);
  const [iouParams, setIouParams] = useState<IOUParams>(defaultIOU);

  const [mintStatus, setMintStatus] = useState<'draft' | 'pending' | 'signed' | 'validated' | 'failed'>('draft');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pushed, setPushed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingFaucet, setGeneratingFaucet] = useState(false);
  const getParams = () => {
    if (tokenType === 'nft') return nftParams;
    if (tokenType === 'mpt') return mptParams;
    return iouParams;
  };

  const canProceedToReview = () => {
    if (tokenType === 'nft') return nftParams.uri.trim().length > 0;
    if (tokenType === 'mpt') return true; // all optional
    return iouParams.currency_code.length === 3 && Number(iouParams.amount) > 0 && iouParams.destination.startsWith('r');
  };

  const walletNetwork = activeWallet?.network || 'mainnet';
  const networkMismatch = network !== walletNetwork;
  const isTestnetFaucetWallet = activeWallet?.provider === 'testnet_faucet';

  const handleGenerateFaucetWallet = useCallback(async () => {
    if (!user) return;
    setGeneratingFaucet(true);
    try {
      const { data, error } = await supabase.functions.invoke('xrpl-testnet-faucet', {});
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Faucet failed');

      await addWallet(
        data.address,
        'Testnet Faucet Wallet',
        null,
        'testnet_faucet',
        data.secret,
        'testnet'
      );

      toast({ title: '✅ Testnet wallet created', description: `Funded with ${data.balance} XRP` });
    } catch (err: any) {
      toast({ title: 'Faucet error', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingFaucet(false);
    }
  }, [user, addWallet]);
  const handleSubmit = useCallback(async () => {
    if (!activeAddress || !user) return;
    setLoading(true);
    setMintError(null);

    try {
      // 1. Build the transaction via edge function
      const { data: buildData, error: buildError } = await supabase.functions.invoke('xrpl-build-mint', {
        body: { token_type: tokenType, network, wallet_address: activeAddress, params: getParams() },
      });

      if (buildError) throw new Error(buildError.message);
      if (!buildData?.success) throw new Error(buildData?.error || 'Failed to build transaction');

      const txJson = buildData.tx_json;

      // Branch: testnet faucet wallet → auto-sign server-side
      if (network === 'testnet' && isTestnetFaucetWallet) {
        setMintStatus('pending');

        const { data: submitData, error: submitError } = await supabase.functions.invoke('xrpl-submit-signed', {
          body: { tx_json: txJson, wallet_address: activeAddress, network },
        });

        if (submitError) throw new Error(submitError.message);
        if (!submitData?.success) throw new Error(submitData?.error || 'Failed to submit transaction');

        // Save mint record as validated
        await supabase.from('token_mints' as any).insert({
          user_id: user.id,
          wallet_address: activeAddress,
          token_type: tokenType,
          network,
          request_json: getParams(),
          tx_json: txJson,
          status: 'validated',
          tx_hash: submitData.tx_hash,
        });

        setMintStatus('validated');
        setTxHash(submitData.tx_hash || null);
        toast({ title: '✅ Token minted successfully!' });

      } else {
        // Mainnet / Xaman flow: send to Xaman for QR-code signing
        const { data: signData, error: signError } = await supabase.functions.invoke('xaman-send-payment', {
          body: { tx_json: txJson },
        });

        if (signError) throw new Error(signError.message);
        if (!signData?.success) throw new Error(signData?.error || 'Failed to create signing request');

        setMintStatus('pending');
        setQrCode(signData.qr_code || null);
        setPushed(signData.pushed || false);

        // Save mint record
        await supabase.from('token_mints' as any).insert({
          user_id: user.id,
          wallet_address: activeAddress,
          token_type: tokenType,
          network,
          request_json: getParams(),
          tx_json: txJson,
          status: 'pending',
          xaman_payload_uuid: signData.uuid,
        });

        // Poll for signing result
        const uuid = signData.uuid;
        const poll = setInterval(async () => {
          try {
            const { data: checkData } = await supabase.functions.invoke('xaman-check-payload', {
              body: { uuid },
            });

            if (checkData?.signed) {
              clearInterval(poll);
              setMintStatus('validated');
              setTxHash(checkData.tx_hash || null);

              await supabase.from('token_mints' as any)
                .update({ status: 'validated', tx_hash: checkData.tx_hash })
                .eq('xaman_payload_uuid', uuid);

              toast({ title: '✅ Token minted successfully!' });
            } else if (checkData?.expired || checkData?.cancelled) {
              clearInterval(poll);
              setMintStatus('failed');
              setMintError(checkData.cancelled ? 'Signing was cancelled.' : 'Signing request expired.');

              await supabase.from('token_mints' as any)
                .update({ status: 'failed' })
                .eq('xaman_payload_uuid', uuid);
            }
          } catch {
            // continue polling
          }
        }, 3000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(poll);
          if (mintStatus === 'pending') {
            setMintStatus('failed');
            setMintError('Signing timed out.');
          }
        }, 300_000);
      }

    } catch (err: any) {
      setMintStatus('failed');
      setMintError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeAddress, activeWallet, user, tokenType, network, nftParams, mptParams, iouParams, isTestnetFaucetWallet]);

  const handleReset = () => {
    setStep('type');
    setMintStatus('draft');
    setTxHash(null);
    setMintError(null);
    setQrCode(null);
    setPushed(false);
    setNftParams(defaultNFT);
    setMptParams(defaultMPT);
    setIouParams(defaultIOU);
  };

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Please sign in to create tokens.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Connect a wallet to start minting tokens.</p>
        </CardContent>
      </Card>
    );
  }

  // Show status screen when minting is in progress or complete
  if (mintStatus !== 'draft') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Mint Status</CardTitle>
        </CardHeader>
        <CardContent>
          <MintStatus
            status={mintStatus}
            txHash={txHash}
            network={network}
            error={mintError}
            qrCode={qrCode}
            pushed={pushed}
            onReset={handleReset}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          Create Token
        </CardTitle>
        <CardDescription>
          {step === 'type' && 'Choose token type and network'}
          {step === 'form' && `Configure your ${TOKEN_INFO[tokenType].label}`}
          {step === 'review' && 'Review and sign your transaction'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Type + Network */}
        {step === 'type' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.entries(TOKEN_INFO) as [TokenType, typeof TOKEN_INFO.nft][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setTokenType(key)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    tokenType === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {info.icon}
                    <span className="font-medium text-sm">{info.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{info.desc}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Network</label>
              <Select value={network} onValueChange={v => setNetwork(v as Network)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="testnet">Testnet (safe testing)</SelectItem>
                  <SelectItem value="mainnet">Mainnet (live)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {network === 'mainnet' && (
              <p className="text-xs text-destructive font-medium">
                ⚠️ Mainnet transactions use real XRP and are irreversible.
              </p>
            )}

            {networkMismatch && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Network mismatch</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Your active wallet is on <strong>{walletNetwork}</strong> but you selected <strong>{network}</strong>. Switch wallets or {network === 'testnet' ? 'generate a testnet wallet' : 'connect a mainnet wallet via Xaman'}.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep('form')}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Type-specific form */}
        {step === 'form' && (
          <>
            <Badge variant="outline" className="mb-2">{TOKEN_INFO[tokenType].label}</Badge>

            {tokenType === 'nft' && <NFTForm params={nftParams} onChange={setNftParams} />}
            {tokenType === 'mpt' && <MPTForm params={mptParams} onChange={setMptParams} />}
            {tokenType === 'iou' && <IOUForm params={iouParams} onChange={setIouParams} />}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('type')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={!canProceedToReview()}>
                Review <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Review + Submit */}
        {step === 'review' && (
          <>
            <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{TOKEN_INFO[tokenType].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <Badge variant={network === 'mainnet' ? 'destructive' : 'secondary'}>{network}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallet</span>
                <span className="font-mono text-xs">{activeAddress?.slice(0, 8)}...{activeAddress?.slice(-6)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Signing</span>
                {network === 'testnet' && isTestnetFaucetWallet ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" /> Auto-sign (testnet)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> Xaman QR
                  </Badge>
                )}
              </div>
              <hr className="border-border" />
              {tokenType === 'nft' && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">URI</span><span className="text-xs max-w-[200px] truncate">{nftParams.uri}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Flags</span><span>{[nftParams.flags.transferable && 'Transferable', nftParams.flags.burnable && 'Burnable', nftParams.flags.onlyXRP && 'OnlyXRP'].filter(Boolean).join(', ') || 'None'}</span></div>
                </>
              )}
              {tokenType === 'mpt' && (
                <>
                  {mptParams.name && <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{mptParams.name}</span></div>}
                  {mptParams.description && <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span className="text-xs max-w-[200px] truncate">{mptParams.description}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Max Supply</span><span>{mptParams.max_amount || 'Unlimited'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Asset Scale</span><span>{mptParams.asset_scale}</span></div>
                  {mptParams.flags.can_transfer && mptParams.transfer_fee > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Transfer Fee</span><span>{(mptParams.transfer_fee / 1000).toFixed(3)}%</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Flags</span><span className="text-right">{[
                    mptParams.flags.can_transfer && 'Transfer',
                    mptParams.flags.can_trade && 'Trade',
                    mptParams.flags.can_lock && 'Lock',
                    mptParams.flags.require_auth && 'Auth',
                    mptParams.flags.can_escrow && 'Escrow',
                    mptParams.flags.can_clawback && 'Clawback',
                  ].filter(Boolean).join(', ') || 'None'}</span></div>
                </>
              )}
              {tokenType === 'iou' && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-mono">{iouParams.currency_code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{iouParams.amount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span className="font-mono text-xs">{iouParams.destination.slice(0, 8)}...</span></div>
                </>
              )}
            </div>

            {networkMismatch ? (
              <div className="space-y-3">
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Network mismatch</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Your wallet is on <strong>{walletNetwork}</strong> but you're minting on <strong>{network}</strong>. Switch wallets or change the network to proceed.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep('form')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  {network === 'testnet' && (
                    <Button onClick={handleGenerateFaucetWallet} disabled={generatingFaucet} variant="hero">
                      {generatingFaucet ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wallet className="w-4 h-4 mr-1" />}
                      Generate Testnet Wallet
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('form')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading} variant="hero">
                  {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  {network === 'testnet' && isTestnetFaucetWallet ? 'Auto-Sign & Submit' : 'Sign & Submit'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MintWizard;
