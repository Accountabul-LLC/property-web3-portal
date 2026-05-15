import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { TradeGuard } from '@/components/TradeGuard';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useWalletCompliance } from '@/hooks/useWalletCompliance';
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio';
import { useTokenMeta, type TokenMeta } from '@/hooks/useTokenMeta';
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
import { TokenPickerDialog, type TokenPickerToken } from '@/components/swap/TokenPickerDialog';
import { ChevronDown } from 'lucide-react';

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

const XRP_LOGO = 'https://cryptologos.cc/logos/xrp-xrp-logo.png';

function assetKey(asset: Asset) {
  return asset.kind === 'xrp' ? 'xrp' : `${asset.currency}:${asset.issuer}`;
}

function assetSymbol(asset: Asset, meta?: TokenMeta | null) {
  if (asset.kind === 'xrp') return 'XRP';
  return meta?.name || decodeCurrency(asset.currency);
}

const Swap = () => {
  const navigate = useNavigate();
  const { activeWallet, activeAddress, activeNetwork, openConnectModal } = useActiveWallet();
  const { data: compliance } = useWalletCompliance(activeAddress);
  const portfolioNetwork = activeNetwork === 'devnet' ? 'testnet' : activeNetwork;
  const { data: portfolio } = useXRPLPortfolio(activeAddress, portfolioNetwork);

  const [sourceAsset, setSourceAsset] = React.useState<Asset>({ kind: 'xrp' });
  const [destinationKind, setDestinationKind] = React.useState<'xrp' | 'token'>('token');
  const [destinationCurrency, setDestinationCurrency] = React.useState('');
  const [destinationIssuer, setDestinationIssuer] = React.useState('');
  const [sourceAmount, setSourceAmount] = React.useState('');
  const [debouncedAmount, setDebouncedAmount] = React.useState('');
  const [quote, setQuote] = React.useState<SwapQuote | null>(null);
  const [txJson, setTxJson] = React.useState<Record<string, unknown> | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [insufficientBalance, setInsufficientBalance] = React.useState(false);
  const [loadingQuote, setLoadingQuote] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState<null | 'source' | 'destination'>(null);
  const [qrCode, setQrCode] = React.useState('');
  const [payloadUuid, setPayloadUuid] = React.useState('');
  const [txHash, setTxHash] = React.useState('');

  const tokenQueries = React.useMemo(() => {
    const list: Array<{ currency: string; issuer: string }> = (portfolio?.token_holdings || []).map(
      (t) => ({ currency: t.currency, issuer: t.issuer }),
    );
    const seen = new Set(list.map((t) => `${t.currency}:${t.issuer}`));
    if (sourceAsset.kind === 'token' && sourceAsset.currency && sourceAsset.issuer) {
      const k = `${sourceAsset.currency}:${sourceAsset.issuer}`;
      if (!seen.has(k)) { list.push({ currency: sourceAsset.currency, issuer: sourceAsset.issuer }); seen.add(k); }
    }
    if (destinationKind === 'token' && destinationCurrency && destinationIssuer) {
      const k = `${destinationCurrency}:${destinationIssuer}`;
      if (!seen.has(k)) list.push({ currency: destinationCurrency, issuer: destinationIssuer });
    }
    return list;
  }, [portfolio?.token_holdings, sourceAsset, destinationKind, destinationCurrency, destinationIssuer]);
  const { data: tokenMetaData } = useTokenMeta(tokenQueries);
  const tokenMap = tokenMetaData?.tokenMap;
  const xrpUsd = tokenMetaData?.xrpUsd ?? 0;

  const getMeta = React.useCallback(
    (asset: Asset): TokenMeta | null => {
      if (asset.kind === 'xrp') return null;
      return tokenMap?.get(`${asset.currency}:${asset.issuer}`) || null;
    },
    [tokenMap],
  );

  const getBalance = React.useCallback(
    (asset: Asset): number => {
      if (asset.kind === 'xrp') return portfolio?.spendable_xrp ?? 0;
      const h = portfolio?.token_holdings?.find(
        (t) => t.currency === asset.currency && t.issuer === asset.issuer,
      );
      return h?.balance ?? 0;
    },
    [portfolio],
  );

  const getUsdValue = React.useCallback(
    (asset: Asset, balance: number): number | null => {
      if (asset.kind === 'xrp') return xrpUsd ? balance * xrpUsd : null;
      const meta = getMeta(asset);
      if (!meta?.price || !xrpUsd) return null;
      // token meta price is in XRP per token
      return balance * meta.price * xrpUsd;
    },
    [getMeta, xrpUsd],
  );

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

  const renderAssetRow = (asset: Asset, opts?: { compact?: boolean }) => {
    const meta = getMeta(asset);
    const symbol = assetSymbol(asset, meta);
    const balance = getBalance(asset);
    const usd = getUsdValue(asset, balance);
    const icon = asset.kind === 'xrp' ? XRP_LOGO : meta?.icon || null;
    return (
      <div className="flex items-center gap-3 w-full min-w-0">
        <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {icon ? (
            <img src={icon} alt={symbol} className="h-full w-full object-cover" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
          ) : (
            symbol.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{symbol}</div>
          {!opts?.compact && asset.kind === 'token' && (
            <div className="text-[11px] text-muted-foreground truncate">{formatAddress(asset.issuer)}</div>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground flex-shrink-0">
          <div className="text-foreground font-medium">{balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
          {usd !== null && <div>${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
        </div>
      </div>
    );
  };

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedAmount(sourceAmount.trim()), 400);
    return () => clearTimeout(timer);
  }, [sourceAmount]);

  // Note: destination intentionally starts unselected so the user picks what to swap INTO,
  // rather than defaulting to a token they already hold (which felt like "swapping into themselves").



  React.useEffect(() => {
    const run = async () => {
      setError('');
      setQuote(null);
      setTxJson(null);
      setWarnings([]);
      setInsufficientBalance(false);

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
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setInsufficientBalance(!!data.insufficient_balance);
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

  // Build wallet token list for picker
  const walletPickerTokens = React.useMemo<TokenPickerToken[]>(() => {
    return (portfolio?.token_holdings || []).map((h) => {
      const meta = tokenMap?.get(`${h.currency}:${h.issuer}`);
      const usd = meta?.price && xrpUsd ? h.balance * meta.price * xrpUsd : null;
      return {
        currency: h.currency,
        issuer: h.issuer,
        name: meta?.name || null,
        icon: meta?.icon || null,
        issuer_name: meta?.issuer_name || null,
        domain: meta?.domain || null,
        balance: h.balance,
        balance_usd: usd,
      };
    });
  }, [portfolio?.token_holdings, tokenMap, xrpUsd]);

  const handlePickerSelect = (
    side: 'source' | 'destination',
    selection: TokenPickerToken | { kind: 'xrp' },
  ) => {
    if ('kind' in selection && selection.kind === 'xrp') {
      if (side === 'source') setSourceAsset({ kind: 'xrp' });
      else setDestinationKind('xrp');
      return;
    }
    const t = selection as TokenPickerToken;
    if (side === 'source') {
      setSourceAsset({ kind: 'token', currency: t.currency, issuer: t.issuer });
    } else {
      setDestinationKind('token');
      setDestinationCurrency(t.currency);
      setDestinationIssuer(t.issuer);
    }
  };

  const renderAssetButton = (asset: Asset, onClick: () => void) => {
    const meta = getMeta(asset);
    const isUnselected = asset.kind === 'token' && (!asset.currency || !asset.issuer);
    const symbol = isUnselected ? 'Select token' : assetSymbol(asset, meta);
    const icon = isUnselected
      ? null
      : asset.kind === 'xrp'
        ? 'https://cryptologos.cc/logos/xrp-xrp-logo.png'
        : meta?.icon || null;
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 bg-background hover:bg-muted/80 border border-border rounded-full pl-1.5 pr-3 py-1.5 transition-colors shadow-sm"
      >
        <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {icon ? (
            <img src={icon} alt={symbol} className="h-full w-full object-cover" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
          ) : (
            isUnselected ? '?' : symbol.slice(0, 2).toUpperCase()
          )}
        </div>
        <span className="font-semibold text-sm">{symbol}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  };

  // Estimated destination amount as a number (for display in receive box)
  const estimatedReceive = React.useMemo(() => {
    if (!quote) return '';
    const v = quote.quoted_destination_amount;
    if (typeof v === 'string') {
      if (destAsset.kind === 'xrp' && /^\d+$/.test(v)) return (Number(v) / 1_000_000).toString();
      return v;
    }
    if (v && typeof v === 'object' && 'value' in v) return String((v as Record<string, string>).value);
    return '';
  }, [quote, destAsset]);

  const sourceUsdValue = React.useMemo(() => {
    const amt = Number(sourceAmount);
    if (!amt) return null;
    if (sourceAsset.kind === 'xrp') return xrpUsd ? amt * xrpUsd : null;
    const meta = getMeta(sourceAsset);
    if (!meta?.price || !xrpUsd) return null;
    return amt * meta.price * xrpUsd;
  }, [sourceAmount, sourceAsset, getMeta, xrpUsd]);

  const destUsdValue = React.useMemo(() => {
    const amt = Number(estimatedReceive);
    if (!amt) return null;
    if (destAsset.kind === 'xrp') return xrpUsd ? amt * xrpUsd : null;
    const meta = getMeta(destAsset);
    if (!meta?.price || !xrpUsd) return null;
    return amt * meta.price * xrpUsd;
  }, [estimatedReceive, destAsset, getMeta, xrpUsd]);

  const flipAssets = () => {
    if (destAsset.kind === 'xrp' && sourceAsset.kind === 'xrp') return;
    const newSource = destAsset;
    if (sourceAsset.kind === 'xrp') {
      setDestinationKind('xrp');
    } else {
      setDestinationKind('token');
      setDestinationCurrency(sourceAsset.currency);
      setDestinationIssuer(sourceAsset.issuer);
    }
    setSourceAsset(newSource);
    setSourceAmount('');
  };


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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 relative">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 mb-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
                Exchange crypto on XRPL
              </h1>
              <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
                Swap your crypto assets here.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-muted/60 capitalize">{activeNetwork}</span>
              <span className="px-2 py-1 rounded-md bg-muted/60 truncate max-w-[140px]">{activeWallet ? activeWallet.label : 'No wallet'}</span>
              <span className={`px-2 py-1 rounded-md ${compliance?.is_trade_enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {compliance?.is_trade_enabled ? 'Trade enabled' : 'Trade locked'}
              </span>
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
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-semibold">Exchange crypto</h2>
                      <p className="text-sm text-muted-foreground mt-1">Send one asset, receive another. Routed through XRPL.</p>
                    </div>
                    <Button
                      variant="ghost"
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

                  <div className="relative space-y-1">
                    {/* You send */}
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">You send</span>
                        <button
                          type="button"
                          onClick={() => {
                            const bal = getBalance(sourceAsset);
                            if (bal > 0) setSourceAmount(String(bal));
                          }}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Balance: {getBalance(sourceAsset).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          <span className="ml-1.5 text-primary font-medium">MAX</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={sourceAmount}
                          onChange={(e) => setSourceAmount(e.target.value)}
                          className="border-0 bg-transparent text-3xl font-semibold p-0 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {renderAssetButton(sourceAsset, () => setPickerOpen('source'))}
                      </div>
                      <div className="mt-1 h-4 text-xs text-muted-foreground">
                        {sourceUsdValue !== null && `≈ $${sourceUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </div>
                    </div>

                    {/* Flip button */}
                    <div className="flex justify-center -my-2 relative z-10">
                      <button
                        type="button"
                        onClick={flipAssets}
                        className="h-9 w-9 rounded-xl bg-background border-4 border-card hover:bg-muted transition-colors flex items-center justify-center shadow"
                        aria-label="Flip assets"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* You receive */}
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">You receive</span>
                        <span className="text-xs text-muted-foreground">
                          Balance: {getBalance(destAsset).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          readOnly
                          placeholder="0.00"
                          value={
                            estimatedReceive
                              ? Number(estimatedReceive).toLocaleString(undefined, { maximumFractionDigits: 6 })
                              : ''
                          }
                          className="border-0 bg-transparent text-3xl font-semibold p-0 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground"
                        />
                        {renderAssetButton(destAsset, () => setPickerOpen('destination'))}
                      </div>
                      <div className="mt-1 h-4 text-xs text-muted-foreground">
                        {destUsdValue !== null && `≈ $${destUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-5">
                    {sourceDisabled ? (
                      <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-start gap-3">
                        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          Trading is not enabled for this wallet. Complete compliance to send a swap.
                        </p>
                      </div>
                    ) : null}

                    {destinationSameAsSource && (
                      <p className="text-sm text-destructive">Pick a different asset to receive.</p>
                    )}

                    {loadingQuote && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Finding the best route...
                      </div>
                    )}

                    {error && !loadingQuote && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    {warnings.length > 0 && !loadingQuote && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                        {warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                        ))}
                      </div>
                    )}

                    <Button
                      className="w-full h-12 text-base gap-2"
                      disabled={!quoteReady || signing || loadingQuote || !sourceAmount || insufficientBalance}
                      onClick={handleSwap}
                    >
                      {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                      {signing
                        ? 'Opening Xaman...'
                        : !sourceAmount
                          ? 'Enter an amount'
                          : insufficientBalance
                            ? 'Insufficient balance'
                            : !quoteReady
                              ? 'Quote unavailable'
                              : `Send ${sourceAmount} ${assetSymbol(sourceAsset, getMeta(sourceAsset))} for ${
                                  estimatedReceive
                                    ? Number(estimatedReceive).toLocaleString(undefined, { maximumFractionDigits: 4 })
                                    : '...'
                                } ${assetSymbol(destAsset, getMeta(destAsset))}`}
                    </Button>
                  </div>
                </Card>


                <Card className="p-6 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      <img
                        src="/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png"
                        alt="Accountabul"
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">Quote preview</h3>
                      <p className="text-xs text-muted-foreground">Powered by Accountabul.</p>
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
                          We package this as a single XRPL payment with the best route attached, then send it to Xaman for you to sign.
                        </p>
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
                          <li>Lock in the route as a ready-to-sign payment.</li>
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

      <TokenPickerDialog
        open={pickerOpen !== null}
        onOpenChange={(o) => !o && setPickerOpen(null)}
        onSelect={(sel) => pickerOpen && handlePickerSelect(pickerOpen, sel)}
        walletTokens={pickerOpen === 'source' ? walletPickerTokens : []}
        xrpBalance={portfolio?.spendable_xrp ?? 0}
        xrpUsd={xrpUsd}
        hideBalances={pickerOpen === 'destination'}
        title={pickerOpen === 'source' ? 'Send' : 'Receive'}
      />
    </div>
  );
};

export default Swap;
