import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Copy, Check, DollarSign, Clock, Coins, FlaskConical, ArrowUpRight, ArrowDownLeft, Building2 } from 'lucide-react';
import { useXRPLPortfolio } from '@/hooks/useXRPLPortfolio';
import { useTokenMeta } from '@/hooks/useTokenMeta';
import type { TreasuryWalletConfig } from '@/config/treasuryWallets';
import { toast } from 'sonner';

const TokenAvatar = ({ issuer, currency, size = 40 }: { issuer?: string; currency?: string; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const isXRP = !issuer || currency === 'XRP';
  const url = isXRP
    ? 'https://cdn.bithomp.com/xrp.svg'
    : `https://cdn.bithomp.com/issued-token/${issuer}/${currency}`;
  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"
      >
        <Coins className="w-1/2 h-1/2 text-primary" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={currency || 'Token'}
      style={{ width: size, height: size }}
      className="rounded-full object-cover bg-muted flex-shrink-0"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

const decodeCurrency = (hex: string) => {
  if (!hex) return '';
  if (hex.length <= 3) return hex;
  try {
    const decoded = hex.replace(/0+$/, '').replace(/../g, (m: string) => String.fromCharCode(parseInt(m, 16)));
    return decoded || hex;
  } catch {
    return hex;
  }
};

const shorten = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const fmt = (n: number, max = 6) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max });
const fmtUsd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ago = (iso: string | null) => {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
};

export const TreasuryWalletCard = ({ wallet }: { wallet: TreasuryWalletConfig }) => {
  const { address, label, network, description } = wallet;
  const { data, isLoading, error, dataUpdatedAt } = useXRPLPortfolio(address, network);
  const [copied, setCopied] = useState(false);

  const explorer =
    network === 'testnet' ? 'https://testnet.xrpl.org' : 'https://livenet.xrpl.org';

  const { data: tokenMetaData } = useTokenMeta(
    data?.token_holdings.map((t) => ({ currency: t.currency, issuer: t.issuer }))
  );
  const tokenMap = tokenMetaData?.tokenMap;
  const xrpUsd = tokenMetaData?.xrpUsd ?? 0;

  const valuation = useMemo(() => {
    if (!data) return null;
    const xrpVal = xrpUsd > 0 ? (data.xrp_balance ?? 0) * xrpUsd : 0;
    let tokenVal = 0;
    let priced = xrpUsd > 0 ? 1 : 0;
    let unpriced = xrpUsd > 0 ? 0 : 1;
    for (const t of data.token_holdings) {
      const meta = tokenMap?.get(`${t.currency}:${t.issuer}`);
      if (meta?.price && meta.price > 0) {
        tokenVal += Number(t.balance) * meta.price;
        priced++;
      } else {
        unpriced++;
      }
    }
    return { totalUsd: xrpVal + tokenVal, priced, unpriced };
  }, [data, xrpUsd, tokenMap]);

  const updatedAgo = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const d = Math.round((Date.now() - dataUpdatedAt) / 1000);
    if (d < 10) return 'just now';
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.round(d / 60)}m ago`;
    return `${Math.round(d / 3600)}h ago`;
  }, [dataUpdatedAt]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive font-medium mb-1">Failed to load treasury data</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </Card>
    );
  }

  if (!data) return null;

  const sortedTokens = [...data.token_holdings].sort((a, b) => {
    const ma = tokenMap?.get(`${a.currency}:${a.issuer}`);
    const mb = tokenMap?.get(`${b.currency}:${b.issuer}`);
    const va = (ma?.price ?? 0) * Number(a.balance);
    const vb = (mb?.price ?? 0) * Number(b.balance);
    return vb - va;
  });

  const allMpts = [
    ...(data.mpt_issuances || []).map((m) => ({
      id: m.mpt_issuance_id,
      name: m.name || m.ticker || 'Unnamed Token',
      image: m.image,
      issuer: m.issuer,
      amount: m.outstanding_amount || '0',
      label: 'Issued',
    })),
    ...(data.mpt_holdings || []).map((h) => {
      const issuance = data.mpt_issuances?.find((i) => i.mpt_issuance_id === h.mpt_issuance_id);
      return {
        id: h.mpt_issuance_id,
        name: issuance?.name || issuance?.ticker || 'MPT Asset',
        image: issuance?.image || null,
        issuer: issuance?.issuer || null,
        amount: h.amount,
        label: 'Held',
      };
    }),
  ];

  const txs = (data.transactions || []).slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card
        className={`p-6 bg-gradient-card ${
          network === 'testnet' ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/10'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h2 className="text-xl font-bold">{label}</h2>
              <Badge
                variant="outline"
                className={
                  network === 'testnet'
                    ? 'border-amber-500/30 text-amber-500 gap-1'
                    : 'border-primary/30 text-primary'
                }
              >
                {network === 'testnet' && <FlaskConical className="w-3 h-3" />}
                {network === 'testnet' ? 'Testnet' : 'Mainnet'}
              </Badge>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mb-2">{description}</p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={copyAddress}
                className="font-mono text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                title="Copy full address"
              >
                {shorten(address)}
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
              <a
                href={`${explorer}/accounts/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View on explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="md:text-right">
            <div className="flex md:justify-end items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Total Wallet Value</p>
            </div>
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {fmtUsd(wallet.mockUsd)}
            </p>
            <div className="flex md:justify-end items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {updatedAgo || 'now'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Token holdings */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          Token Holdings
        </h3>
        <div className="space-y-3">
          {/* XRP row */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
            <div className="flex items-center gap-3">
              <TokenAvatar currency="XRP" />
              <div>
                <p className="font-semibold">XRP</p>
                <p className="text-xs text-muted-foreground">Native · XRP Ledger</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">
                {fmt(data.xrp_balance ?? 0)} <span className="text-xs text-muted-foreground">XRP</span>
              </p>
              {xrpUsd > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {fmtUsd((data.xrp_balance ?? 0) * xrpUsd)}
                </p>
              )}
            </div>
          </div>

          {sortedTokens.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No additional token holdings
            </p>
          )}

          {sortedTokens.map((t) => {
            const meta = tokenMap?.get(`${t.currency}:${t.issuer}`);
            const symbol = meta?.name || decodeCurrency(t.currency);
            const usd = meta?.price && meta.price > 0 ? Number(t.balance) * meta.price : null;
            return (
              <div
                key={`${t.currency}:${t.issuer}`}
                className="flex items-center justify-between p-3 rounded-md bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TokenAvatar currency={t.currency} issuer={t.issuer} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{symbol}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meta?.issuer_name || shorten(t.issuer)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{fmt(Number(t.balance))}</p>
                  {usd !== null ? (
                    <p className="text-xs text-muted-foreground">≈ {fmtUsd(usd)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No USD price</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* MPT / RWA */}
      {allMpts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Property / RWA Holdings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allMpts.map((m, i) => (
              <div
                key={`${m.id}-${i}`}
                className="border border-border rounded-md p-3 flex items-center gap-3 bg-muted/20"
              >
                {m.image ? (
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-12 h-12 rounded object-cover bg-muted shrink-0"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.amount} units · {m.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent transactions</p>
        ) : (
          <div className="space-y-2">
            {txs.map((tx) => {
              const sent = tx.direction === 'sent';
              const Icon = sent ? ArrowUpRight : ArrowDownLeft;
              return (
                <a
                  key={tx.hash}
                  href={`${explorer}/transactions/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        sent ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sent ? 'Sent' : 'Received'} {tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground">{ago(tx.date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {fmt(tx.amount)} {decodeCurrency(tx.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.result}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TreasuryWalletCard;
