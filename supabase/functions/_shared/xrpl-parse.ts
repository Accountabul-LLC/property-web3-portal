// Shared XRPL parsing and request helpers used by xrpl-account-data and
// xrpl-accounts-batch. Keep this module dependency-free (no Supabase client,
// no env reads) so both edge functions can import it cheaply.

export const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
export const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  let lastError: Error | null = null;
  for (const node of nodes) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await delay(RETRY_DELAY_MS * attempt);
        const res = await fetch(node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, params }),
        });
        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`);
          if (attempt < MAX_RETRIES) continue;
          break;
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          lastError = new Error(`Non-JSON from ${node} (${res.status}): ${text.slice(0, 120)}`);
          if (text.toLowerCase().includes('rate limit') && attempt < MAX_RETRIES) continue;
          break;
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        break;
      }
    }
  }
  throw lastError || new Error('All XRPL nodes failed');
}

export function decodeHexString(hex: string): string {
  try {
    return hex.match(/../g)?.map((h: string) => String.fromCharCode(parseInt(h, 16))).join('') || '';
  } catch {
    return '';
  }
}

const PT_REVERSE: Record<string, string> = {
  sfh: 'Single Family', mf: 'Multi-Family', condo: 'Condo / Apartment',
  th: 'Townhouse', comm: 'Commercial', ind: 'Industrial',
  land: 'Land / Lot', mix: 'Mixed-Use', other: 'Other',
};

const AI_KEY_LABELS: Record<string, string> = {
  adr: 'Address', ct: 'City', st: 'State', zip: 'ZIP', cc: 'Country',
  pt: 'Type', b: 'Beds', ba: 'Baths', sf: 'SqFt', yb: 'Built',
  val: 'Value', cur: 'Currency', asof: 'As Of', em: 'Contact',
  address: 'Address', city: 'City', state: 'State', country: 'Country',
  property_type: 'Type', bedrooms: 'Beds', bathrooms: 'Baths', sqft: 'SqFt', year_built: 'Built',
  value_usd: 'Asset Value (USD)', contact: 'Contact',
};

export function parseMPTIssuances(objects: any[]) {
  return objects
    .filter((obj: any) => obj.LedgerEntryType === 'MPTokenIssuance')
    .map((obj: any) => {
      let metadata: Record<string, any> = {};
      if (obj.MPTokenMetadata) {
        const decoded = decodeHexString(obj.MPTokenMetadata);
        try {
          metadata = JSON.parse(decoded);
        } catch {
          if (decoded && /^[\x20-\x7E\s]+$/.test(decoded)) metadata = { name: decoded };
        }
      }
      const isCompressed = 'n' in metadata || 't' in metadata;
      let name: string | null = null, description: string | null = null, image: string | null = null;
      let ticker: string | null = null, asset_class: string | null = null, asset_subclass: string | null = null;
      let issuer_name: string | null = null, uris: string[] | null = null, nft_type: string | null = null;
      let collection: { name?: string; family?: string } | null = null;
      let attributes: Array<{ trait_type: string; value: string | number }> | null = null;

      if (isCompressed) {
        ticker = metadata.t || null;
        name = metadata.n || null;
        description = metadata.d || null;
        image = metadata.i || null;
        asset_class = metadata.ac || null;
        asset_subclass = metadata.as || null;
        issuer_name = metadata.in || null;
        uris = Array.isArray(metadata.us) ? metadata.us : null;
        if (asset_class || asset_subclass) {
          collection = {
            name: asset_class === 'rwa' ? 'RWA Token' : (asset_class || undefined),
            family: asset_subclass ? (PT_REVERSE[asset_subclass] || asset_subclass) : undefined,
          };
        }
        if (metadata.ai && typeof metadata.ai === 'object') {
          const attrs: Array<{ trait_type: string; value: string | number }> = [];
          for (const [key, val] of Object.entries(metadata.ai)) {
            if (val !== null && val !== undefined && key !== 'cur' && key !== 'asof') {
              const label = AI_KEY_LABELS[key] || key;
              const displayVal = key === 'pt' && typeof val === 'string' && PT_REVERSE[val]
                ? PT_REVERSE[val] : val;
              attrs.push({ trait_type: label, value: displayVal as string | number });
            }
          }
          if (attrs.length > 0) attributes = attrs;
        }
      } else {
        name = metadata.name || null;
        description = metadata.description || null;
        image = metadata.image || null;
        nft_type = metadata.nftType || null;
        collection = metadata.collection || null;
        attributes = Array.isArray(metadata.attributes) ? metadata.attributes : null;
      }

      let value_usd: number | null = null;
      if (metadata.ai && typeof metadata.ai === 'object') {
        const raw = (metadata.ai as any).value_usd ?? (metadata.ai as any).val;
        const n = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(n) && n > 0) value_usd = n;
      }

      return {
        mpt_issuance_id: obj.MPTokenIssuanceID || obj.mpt_issuance_id || null,
        issuer: obj.Issuer || obj.Account || null,
        max_amount: obj.MaximumAmount ? String(obj.MaximumAmount) : null,
        outstanding_amount: obj.OutstandingAmount ? String(obj.OutstandingAmount) : null,
        asset_scale: obj.AssetScale ?? 0,
        transfer_fee: obj.TransferFee ?? 0,
        flags: obj.Flags ?? 0,
        metadata_hex: obj.MPTokenMetadata || null,
        name, description, image, nft_type, collection, attributes,
        schema: metadata.schema || null,
        ticker, asset_class, asset_subclass, issuer_name, uris, value_usd,
      };
    });
}

export function parseMPTHoldings(objects: any[]) {
  return objects
    .filter((obj: any) => obj.LedgerEntryType === 'MPToken')
    .map((obj: any) => ({
      mpt_issuance_id: obj.MPTokenIssuanceID || null,
      amount: obj.MPTAmount ? String(obj.MPTAmount) : '0',
      flags: obj.Flags ?? 0,
      locked_amount: obj.LockedAmount ? String(obj.LockedAmount) : null,
    }));
}

export function parseTransactions(txList: any[], wallet_address: string) {
  return txList.map((entry: any) => {
    const tx = entry.tx || entry.tx_json || {};
    const meta = entry.meta || {};
    const date = tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null;

    let amount = 0, currency = 'XRP', issuer: string | null = null;
    const txType = tx.TransactionType || 'Unknown';

    if (tx.Amount) {
      if (typeof tx.Amount === 'string') {
        amount = Number(tx.Amount) / 1_000_000;
      } else if (tx.Amount.value) {
        amount = Number(tx.Amount.value);
        currency = tx.Amount.currency;
        issuer = tx.Amount.issuer || null;
      }
    }

    const delivered = meta.delivered_amount;
    let deliveredAmount: number | null = null, deliveredCurrency: string | null = null;
    if (delivered) {
      if (typeof delivered === 'string') {
        deliveredAmount = Number(delivered) / 1_000_000;
        deliveredCurrency = 'XRP';
      } else if (delivered.value) {
        deliveredAmount = Number(delivered.value);
        deliveredCurrency = delivered.currency;
      }
    }

    const direction = tx.Destination === wallet_address ? 'received' : 'sent';
    const sender = tx.Account || null;
    const destination = tx.Destination || null;

    const memos: string[] = [];
    if (tx.Memos && Array.isArray(tx.Memos)) {
      for (const m of tx.Memos) {
        if (m.Memo?.MemoData) {
          try {
            const text = decodeHexString(m.Memo.MemoData);
            if (text && /^[\x20-\x7E\s]+$/.test(text)) memos.push(text);
          } catch { /* noop */ }
        }
      }
    }

    const balanceChanges: Array<{ account: string; currency: string; issuer?: string; value: number }> = [];
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
        if (!modified) continue;
        if (modified.LedgerEntryType === 'RippleState') {
          const finalBal = modified.FinalFields?.Balance?.value;
          const prevBal = modified.PreviousFields?.Balance?.value;
          if (finalBal !== undefined && prevBal !== undefined) {
            const change = Number(finalBal) - Number(prevBal);
            if (change !== 0) {
              balanceChanges.push({
                account: modified.FinalFields?.HighLimit?.issuer === wallet_address
                  ? wallet_address
                  : (modified.FinalFields?.LowLimit?.issuer === wallet_address ? wallet_address : ''),
                currency: modified.FinalFields?.Balance?.currency || 'Unknown',
                issuer: modified.FinalFields?.HighLimit?.issuer === wallet_address
                  ? modified.FinalFields?.LowLimit?.issuer
                  : modified.FinalFields?.HighLimit?.issuer,
                value: change,
              });
            }
          }
        }
      }
    }

    const isSwap = txType === 'OfferCreate' ||
      (txType === 'Payment' && balanceChanges.filter((bc) => bc.account === wallet_address).length > 1);

    let takerPays: { currency: string; value: number; issuer?: string } | null = null;
    let takerGets: { currency: string; value: number; issuer?: string } | null = null;
    if (tx.TakerPays) {
      takerPays = typeof tx.TakerPays === 'string'
        ? { currency: 'XRP', value: Number(tx.TakerPays) / 1_000_000 }
        : { currency: tx.TakerPays.currency, value: Number(tx.TakerPays.value), issuer: tx.TakerPays.issuer };
    }
    if (tx.TakerGets) {
      takerGets = typeof tx.TakerGets === 'string'
        ? { currency: 'XRP', value: Number(tx.TakerGets) / 1_000_000 }
        : { currency: tx.TakerGets.currency, value: Number(tx.TakerGets.value), issuer: tx.TakerGets.issuer };
    }

    return {
      hash: tx.hash,
      type: isSwap ? 'Swap' : txType,
      direction, amount, currency, issuer,
      delivered_amount: deliveredAmount, delivered_currency: deliveredCurrency,
      date,
      fee: tx.Fee ? Number(tx.Fee) / 1_000_000 : 0,
      sender, destination,
      destination_tag: tx.DestinationTag ?? null,
      memos: memos.length > 0 ? memos : null,
      result: meta.TransactionResult || null,
      is_swap: isSwap,
      taker_pays: takerPays, taker_gets: takerGets,
      balance_changes: balanceChanges.length > 0 ? balanceChanges : null,
    };
  });
}

// Run the full 5-call fetch for a single wallet. Returns the same shape as
// xrpl-account-data's responseData (without writing to caches — caller decides).
export async function fetchWalletPayload(wallet_address: string, network: 'mainnet' | 'testnet') {
  const nodes = network === 'testnet' ? TESTNET_NODES : MAINNET_NODES;

  const accountInfoRes = await xrplRequest(nodes, 'account_info', [{ account: wallet_address, ledger_index: 'validated' }]);
  await delay(100);
  const accountLinesRes = await xrplRequest(nodes, 'account_lines', [{ account: wallet_address, ledger_index: 'validated' }]);
  await delay(100);
  const accountTxRes = await xrplRequest(nodes, 'account_tx', [{ account: wallet_address, ledger_index_min: -1, ledger_index_max: -1, limit: 20 }]);
  await delay(100);
  const mptIssuanceRes = await xrplRequest(nodes, 'account_objects', [{ account: wallet_address, type: 'mpt_issuance', ledger_index: 'validated' }]);
  await delay(100);
  const mptHoldingRes = await xrplRequest(nodes, 'account_objects', [{ account: wallet_address, type: 'mptoken', ledger_index: 'validated' }]);

  let xrpBalance = 0, ownerCount = 0;
  const accountData = accountInfoRes.result?.account_data;
  if (accountData?.Balance) xrpBalance = Number(accountData.Balance) / 1_000_000;
  if (accountData?.OwnerCount !== undefined) ownerCount = Number(accountData.OwnerCount);

  const baseReserve = 1, ownerReserve = 0.2;
  const totalReserve = baseReserve + ownerCount * ownerReserve;
  const spendableXrp = Math.max(0, xrpBalance - totalReserve);

  const tokenHoldings = (accountLinesRes.result?.lines || []).map((line: any) => ({
    currency: line.currency,
    issuer: line.account,
    balance: Number(line.balance),
    limit: Number(line.limit),
  })).filter((t: any) => t.balance !== 0);

  return {
    xrp_balance: xrpBalance,
    reserve_xrp: totalReserve,
    spendable_xrp: spendableXrp,
    owner_count: ownerCount,
    token_holdings: tokenHoldings,
    transactions: parseTransactions(accountTxRes.result?.transactions || [], wallet_address),
    mpt_issuances: parseMPTIssuances(mptIssuanceRes.result?.account_objects || []),
    mpt_holdings: parseMPTHoldings(mptHoldingRes.result?.account_objects || []),
    account: wallet_address,
    network,
  };
}
