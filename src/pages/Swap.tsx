import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { TradeGuard } from '@/components/TradeGuard';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useWalletCompliance } from '@/hooks/useWalletCompliance';
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  ArrowUpDown,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Asset =
  | { kind: 'xrp' }
  | { kind: 'token'; currency: string; issuer: string };

type SwapQuote = {
  source_asset: Asset;
  destination_asset: Asset;
  source_amount: string;
  quoted_source_amount: string | Record<string, unknown>;
  quoted_destination_amount: string | Record<string, unknown>;
  alternative_count: number;
  full_reply: boolean;
  validated: boolean;
};

function decodeCurrency(hexOrText: string) {
  if (!hexOrText || hexOrText.length <= 3) return hexOrText;
  if (!/^[0-9A-F]+$/i.test(hexOrText) || hexOrText.length % 2 !== 0) return hexOrText;
  try {
    const decoded = hexOrText
      .match(/.{1,2}/g)
      ?.map((pair) => String.fromCharCode(parseInt(pair, 16)))
      .join('') ?? hexOrText;
    return decoded.replace(/\0+$/g, '').trim() || hexOrText;
  } catch {
    return hexOrText;
  }
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAsset(asset: Asset) {
  return asset.kind === 'xrp' ? 'XRP' : `${decodeCurrency(asset.currency)} - ${formatAddress(asset.issuer)}`;
}

function formatAmount(value: unknown, asset: Asset) {
  if (typeof value === 'string') {
    if (asset.kind === 'xrp' && /^\d+$/.test(value)) {
      return `${(Number(value) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP`;
    }
    return asset.kind === 'token'
      ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${decodeCurrency(asset.currency)}`
      : value;
  }

  if (value && typeof value === 'object' && 'value' in value) {
    const obj = value as Record<string, string>;
    return `${obj.value} ${asset.kind === 'token' ? decodeCurrency(asset.currency) : 'XRP'}`;
  }

  return '-';
}

const Swap = () => {
  const navigate = useNavigate();
  const { activeWallet, activeAddress, activeNetwork, openConnectModal } = useActiveWallet();
  const { data: compliance } = useWalletCompliance(activeAddress);
  const portfolioNetwork = activeNetwork === 'devnet' ? 'testnet' : activeNetwork;
  const { data: portfolio } = useXRPLPortfolio(activeAddress, portfolioNetwork);

  const [sourceAsset, setSourceAsset] = React.useState<Asset>({ kind: 'xrp' });
  const [destinationKind, setDestinationKind] = React.useState<'xrp' | 'token'>('token');
  const [destinationCurrency, setDestinationCurrency] = React.useState('USD');
  const [destinationIssuer, setDestinationIssuer] = React.useState('');
  const [sourceAmount, setSourceAmount] = React.useState('');
  const [debouncedAmount, setDebouncedAmount] = React.useState('');
  const [quote, setQuote] = React.useState<SwapQuote | null>(null);
  const [txJson, setTxJson] = React.useState<Record<string, unknown> | null>(null);
  const [loadingQuote, setLoadingQuote] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [error, setError] = React.useState('');
  const [qrCode, setQrCode] = React.useState('');
  const [payloadUuid, setPayloadUuid] = React.useState('');
  const [txHash, setTxHash] = React.useState('');

  const sourceOptions = React.useMemo<Asset[]>(() => {
    const holdings = (portfolio?.token_holdings || [])
      .filter((token) => token.balance > 0)
      .map<Asset>((token) => ({
        kind: 'token',
        currency: token.currency,
        issuer: token.issuer,
      }));
    return [{ kind: 'xrp' }, ...holdings];
  }, [portfolio?.token_holdings]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedAmount(sourceAmount.trim()), 400);
    return () => clearTimeout(timer);
  }, [sourceAmount]);

  React.useEffect(() => {
    if (destinationKind === 'token' && !destinationIssuer && portfolio?.token_holdings?.length) {
      const first = portfolio.token_holdings.find((t) => t.balance > 0) || portfolio.token_holdings[0];
      if (first) {
        setDestinationCurrency(first.currency);
        setDestinationIssuer(first.issuer);
      }
    }
  }, [destinationKind, destinationIssuer, portfolio?.token_holdings]);

  React.useEffect(() => {
    const run = async () => {
      setError('');
      setQuote(null);
      setTxJson(null);

      if (!activeAddress || !debouncedAmount) return;
      if (!activeWallet || !compliance?.is_trade_enabled) return;
      if (sourceAsset.kind === 'token' && !sourceAsset.currency.trim()) return;
      if (destinationKind === 'token' && (!destinationCurrency.trim() || !destinationIssuer.trim())) return;
      if (
        sourceAsset.kind === 'token' &&
        destinationKind === 'token' &&
        sourceAsset.currency.trim().toUpperCase() === destinationCurrency.trim().toUpperCase() &&
        sourceAsset.issuer.trim() === destinationIssuer.trim()
      ) {
        return;
      }

      setLoadingQuote(true);
      try {
        const destinationAsset: Asset = destinationKind === 'xrp'
          ? { kind: 'xrp' }
          : { kind: 'token', currency: destinationCurrency.trim().toUpperCase(), issuer: destinationIssuer.trim() };

        const { data, error: invokeError } = await supabase.functions.invoke('xrpl-build-swap', {
          body: {
            wallet_address: activeAddress,
            source_asset: sourceAsset,
            destination_asset: destinationAsset,
            source_amount: debouncedAmount,
            network: activeNetwork,
          },
        });

        if (invokeError) throw invokeError;
        if (!data?.success) throw new Error(data?.error || 'Failed to build swap quote');

        setQuote(data.quote as SwapQuote);
        setTxJson(data.tx_json as Record<string, unknown>);
      } catch (err: any) {
        setError(err?.message || 'Unable to build swap quote');
      } finally {
        setLoadingQuote(false);
      }
    };

    run();
  }, [activeAddress, activeNetwork, debouncedAmount, destinationCurrency, destinationIssuer, destinationKind, sourceAsset]);

  const destAsset: Asset = destinationKind === 'xrp'
    ? { kind: 'xrp' }
    : { kind: 'token', currency: destinationCurrency.trim().toUpperCase(), issuer: destinationIssuer.trim() };

  const sourceDisabled = !activeWallet || !compliance?.is_trade_enabled;
  const destinationSameAsSource =
    sourceAsset.kind === 'xrp'
      ? destAsset.kind === 'xrp'
      : destAsset.kind === 'token' &&
        sourceAsset.currency.trim().toUpperCase() === destAsset.currency.trim().toUpperCase() &&
        sourceAsset.issuer.trim() === destAsset.issuer.trim();

  const quoteReady = !!quote && !!txJson && !destinationSameAsSource && !sourceDisabled;

  const handleSwap = async () => {
    if (!quoteReady || !txJson) return;
    setSigning(true);
    setError('');
    setPayloadUuid('');
    setQrCode('');
    setTxHash('');

    try {
      const { data, error } = await supabase.functions.invoke('xaman-send-payment', {
        body: { tx_json: txJson },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create Xaman payload');

      setQrCode(data.qr_code || '');
      setPayloadUuid(data.uuid || '');

      const poll = setInterval(async () => {
        try {
          const { data: checkData, error: checkError } = await supabase.functions.invoke('xaman-check-payload', {
            body: { uuid: data.uuid },
          });
          if (checkError) throw checkError;
          if (checkData?.signed) {
            clearInterval(poll);
            setTxHash(checkData.tx_hash || '');
            toast.success('Swap signed and submitted');
          } else if (checkData?.cancelled || checkData?.expired) {
            clearInterval(poll);
            throw new Error(checkData.cancelled ? 'Swap was rejected in Xaman' : 'Signing request expired');
          }
        } catch (pollErr: any) {
          clearInterval(poll);
          setError(pollErr?.message || 'Unable to confirm signing status');
          toast.error(pollErr?.message || 'Unable to confirm signing status');
        }
      }, 2000);

      setTimeout(() => clearInterval(poll), 300000);
    } catch (err: any) {
      setError(err?.message || 'Failed to start swap');
      toast.error(err?.message || 'Failed to start swap');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4 gap-2 px-3 py-1">
                <Sparkles className="w-3.5 h-3.5" />
                XRPL Swap Engine
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
                Route swaps through the XRPL DEX and AMM.
              </h1>
              <p className="mt-4 text-muted-foreground text-base sm:text-lg">
                Live pathfinding quotes, wallet-aware balances, and Xaman signing. The swap is built as a self-payment on the XRP Ledger, so you get native routing without smart contracts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-lg">
              <Card className="p-4 bg-card/70 backdrop-blur">
                <div className="text-xs text-muted-foreground">Wallet</div>
                <div className="mt-1 font-medium truncate">{activeWallet ? activeWallet.label : 'Not connected'}</div>
              </Card>
              <Card className="p-4 bg-card/70 backdrop-blur">
                <div className="text-xs text-muted-foreground">Network</div>
                <div className="mt-1 font-medium capitalize">{activeNetwork}</div>
              </Card>
              <Card className="p-4 bg-card/70 backdrop-blur">
                <div className="text-xs text-muted-foreground">Trade access</div>
                <div className="mt-1 font-medium">{compliance?.is_trade_enabled ? 'Enabled' : 'Locked'}</div>
              </Card>
            </div>
          </div>

          {!activeWallet ? (
            <Card className="p-6 border-dashed flex flex-col items-center text-center gap-4">
              <Wallet className="w-10 h-10 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Connect a wallet to start quoting</h2>
                <p className="text-sm text-muted-foreground mt-1">The swap engine reads your XRPL holdings and builds a quote against your active wallet.</p>
              </div>
              <Button onClick={openConnectModal} className="gap-2">
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </Button>
            </Card>
          ) : (
            <TradeGuard
              fallback={
                <Card className="p-6 border-amber-200 bg-amber-50/60 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h2 className="font-semibold">Trading access required</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Complete KYC and wallet registration before using the swap engine.
                      </p>
                      <Button className="mt-4" variant="outline" onClick={() => navigate('/kyc')}>
                        Go to KYC
                      </Button>
                    </div>
                  </div>
                </Card>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
                <Card className="p-6 shadow-lg">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-semibold">Build swap quote</h2>
                      <p className="text-sm text-muted-foreground mt-1">Choose the asset you pay and the asset you want back.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSourceAmount('');
                        setQuote(null);
                        setTxJson(null);
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>Pay with</Label>
                      <Select
                        value={sourceAsset.kind === 'xrp' ? 'xrp' : `${sourceAsset.currency}:${sourceAsset.issuer}`}
                        onValueChange={(value) => {
                          if (value === 'xrp') {
                            setSourceAsset({ kind: 'xrp' });
                            return;
                          }
                          const [currency, issuer] = value.split(':');
                          setSourceAsset({ kind: 'token', currency, issuer });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose source asset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xrp">XRP</SelectItem>
                          {sourceOptions
                            .filter((asset): asset is Extract<Asset, { kind: 'token' }> => asset.kind === 'token')
                            .map((asset) => (
                              <SelectItem key={`${asset.currency}:${asset.issuer}`} value={`${asset.currency}:${asset.issuer}`}>
                                {formatAsset(asset)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {sourceAsset.kind === 'token' && (
                        <p className="text-xs text-muted-foreground">Using your wallet balance for this trustline.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="source-amount">Amount in</Label>
                        <Input
                          id="source-amount"
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={sourceAmount}
                          onChange={(e) => setSourceAmount(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-center md:pb-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Receive as</Label>
                        <Select value={destinationKind} onValueChange={(v) => setDestinationKind(v as 'xrp' | 'token')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="token">Token</SelectItem>
                            <SelectItem value="xrp">XRP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {destinationKind === 'token' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dest-currency">Destination currency</Label>
                          <Input
                            id="dest-currency"
                            value={destinationCurrency}
                            onChange={(e) => setDestinationCurrency(e.target.value.toUpperCase())}
                            placeholder="USD"
                            maxLength={40}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dest-issuer">Destination issuer</Label>
                          <Input
                            id="dest-issuer"
                            value={destinationIssuer}
                            onChange={(e) => setDestinationIssuer(e.target.value.trim())}
                            placeholder="r..."
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {sourceDisabled ? (
                      <Card className="p-4 border-dashed bg-muted/30">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Trading is not enabled for this wallet</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              The page can still show the UI, but quotes and signing are blocked until compliance is complete.
                            </p>
                          </div>
                        </div>
                      </Card>
                    ) : null}

                    {destinationSameAsSource ? (
                      <p className="text-sm text-destructive">Pick a different destination asset.</p>
                    ) : null}

                    {loadingQuote && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Building live quote...
                      </div>
                    )}

                    {error && !loadingQuote && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Quote preview</h3>
                      <p className="text-xs text-muted-foreground">Powered by `ripple_path_find`.</p>
                    </div>
                  </div>

                  {quote ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">You send</span>
                          <span className="font-medium text-right">
                            {sourceAmount || '0'} {sourceAsset.kind === 'xrp' ? 'XRP' : decodeCurrency(sourceAsset.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">You receive</span>
                          <span className="font-semibold text-right">{formatAmount(quote.quoted_destination_amount, destAsset)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">Source path cost</span>
                          <span className="text-right">{formatAmount(quote.quoted_source_amount, sourceAsset)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/40">
                          <div className="text-xs text-muted-foreground">Routes found</div>
                          <div className="font-medium mt-1">{quote.alternative_count}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40">
                          <div className="text-xs text-muted-foreground">Ledger response</div>
                          <div className="font-medium mt-1">{quote.full_reply ? 'Full' : 'Partial'}</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-primary/15 bg-primary/5 text-sm">
                        <div className="flex items-center gap-2 font-medium text-primary">
                          <CheckCircle2 className="w-4 h-4" />
                          Prepared for signing
                        </div>
                        <p className="text-muted-foreground mt-1">
                          The app builds a self-payment `Payment` transaction with `SendMax`, `Amount`, and `Paths`, then hands it to Xaman.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          className="flex-1 gap-2"
                          disabled={!quoteReady || signing || loadingQuote}
                          onClick={handleSwap}
                        >
                          {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                          {signing ? 'Opening Xaman...' : 'Swap in Xaman'}
                        </Button>
                      </div>

                      {qrCode && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Xaman payload</span>
                            <span className="text-xs text-muted-foreground">{payloadUuid ? formatAddress(payloadUuid) : 'Created'}</span>
                          </div>
                          <div className="flex justify-center">
                            <img src={qrCode} alt="Xaman signing QR" className="w-44 h-44 rounded-lg border border-border" />
                          </div>
                        </div>
                      )}

                      {txHash && (
                        <a
                          href={`https://livenet.xrpl.org/transactions/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-primary hover:underline"
                        >
                          View submitted transaction
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>Enter a source amount and a destination asset to generate a live quote.</p>
                      <div className="rounded-lg border border-dashed p-4 bg-muted/20">
                        <p className="font-medium text-foreground">Swap flow</p>
                        <ol className="mt-2 space-y-2 list-decimal list-inside">
                          <li>Quote the route through XRPL order books and AMMs.</li>
                          <li>Build a `Payment` transaction with the quoted path.</li>
                          <li>Sign and submit in Xaman.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </TradeGuard>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Swap;
