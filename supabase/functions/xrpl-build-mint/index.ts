import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { z } from 'https://esm.sh/zod@3.23.8';
import { isValidXRPLAddress, parseJsonBody } from '../_shared/auth.ts';

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app'),
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  };
}

const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_MPT_FIELD_LENGTHS = {
  name: 80,
  description: 280,
  ticker: 10,
  image_url: 512,
  property_address: 200,
  city: 100,
  state: 100,
  zip: 20,
  country: 100,
  property_type: 80,
  owner_name: 120,
  owner_email: 254,
  uri: 512,
  currency_code: 20,
  destination: 34,
} as const;
type UriEntry = { u: string; c: string; t: string };
const buildMintRequestSchema = z.object({
  token_type: z.enum(['nft', 'mpt', 'iou']),
  network: z.enum(['testnet', 'mainnet']),
  wallet_address: z.string().trim().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'wallet_address must be a valid XRPL address'),
  params: z.record(z.unknown()).optional().nullable(),
});

async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  let lastError: Error | null = null;
  for (const node of nodes) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        const res = await fetch(node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, params }),
        });
        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`);
          console.warn(`${node} returned ${res.status}, attempt ${attempt + 1}`);
          if (attempt < MAX_RETRIES) continue;
          break;
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          lastError = new Error(`Non-JSON from ${node}: ${text.slice(0, 120)}`);
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

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function parseLimitedString(
  value: unknown,
  max: number,
  field: string,
  required = false,
): { value: string | null; error: string | null } {
  if (value === undefined || value === null) {
    return required ? { value: null, error: `${field} is required` } : { value: null, error: null };
  }
  if (typeof value !== 'string') {
    return { value: null, error: `${field} must be a string` };
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { value: null, error: `${field} is required` };
  }
  if (trimmed.length > max) {
    return { value: null, error: `${field} must be at most ${max} characters` };
  }
  return { value: trimmed.length > 0 ? trimmed : null, error: null };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await parseJsonBody<unknown>(req, corsHeaders);
    if (body instanceof Response) return body;

    const parsed = buildMintRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return new Response(JSON.stringify({ error: firstIssue?.message || 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token_type, network, wallet_address, params } = parsed.data;

    const nodes = network === 'testnet' ? TESTNET_NODES : MAINNET_NODES;

    // Auth + wallet ownership verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    // SEC-014: Enforce KYC approval server-side — the React KycGate is not sufficient
    const { data: kycCase, error: kycError } = await supabase
      .from('kyc_cases')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (kycError) {
      console.error('KYC lookup error:', kycError);
      return new Response(JSON.stringify({ error: 'Unable to verify identity status' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const kycStatus = kycCase?.status ?? 'not_started';
    if (kycStatus !== 'approved') {
      return new Response(JSON.stringify({
        error: 'Identity verification required',
        kyc_status: kycStatus,
        message: `KYC status is '${kycStatus}'. Approval required before minting.`,
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: walletLink } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', wallet_address)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!walletLink) {
      return new Response(JSON.stringify({ error: 'Wallet not linked to your account.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch account info with failover node pool
    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, 'account_info', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest(nodes, 'server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') {
      return new Response(JSON.stringify({ error: `Account not found on XRPL ${network}. Fund it first.` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) {
      return new Response(JSON.stringify({ error: 'Could not fetch account data from XRPL.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validatedLedger = serverInfoRes.result?.info?.validated_ledger?.seq || 0;
    const lastLedgerSequence = validatedLedger + 30;
    const feeDrops = '12';

    let txJson: Record<string, unknown>;

    if (token_type === 'nft') {
      const { uri, flags } = (params || {}) as Record<string, any>;
      const uriResult = parseLimitedString(uri, MAX_MPT_FIELD_LENGTHS.uri, 'uri', true);
      if (uriResult.error) {
        return new Response(JSON.stringify({ error: uriResult.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const cleanUri = uriResult.value!;

      let nftFlags = 0;
      if (flags?.transferable) nftFlags |= 0x00000008;
      if (flags?.burnable) nftFlags |= 0x00000001;
      if (flags?.onlyXRP) nftFlags |= 0x00000002;

      txJson = {
        TransactionType: 'NFTokenMint',
        Account: wallet_address,
        URI: toHex(cleanUri),
        Flags: nftFlags,
        NFTokenTaxon: 0,
        Fee: feeDrops,
      };

    } else if (token_type === 'mpt') {
      // MPTokenIssuanceCreate
      const { name, description, max_amount, asset_scale, transfer_fee, flags } = (params || {}) as Record<string, any>;
      const { ticker, property_address, city, state, zip, country, property_type, bedrooms, bathrooms, square_feet, year_built, estimated_value, owner_name, owner_email, image_url, uris } = (params || {}) as Record<string, any>;
      const limited = {
        name: parseLimitedString(name, MAX_MPT_FIELD_LENGTHS.name, 'name'),
        description: parseLimitedString(description, MAX_MPT_FIELD_LENGTHS.description, 'description'),
        ticker: parseLimitedString(ticker, MAX_MPT_FIELD_LENGTHS.ticker, 'ticker'),
        image_url: parseLimitedString(image_url, MAX_MPT_FIELD_LENGTHS.image_url, 'image_url'),
        property_address: parseLimitedString(property_address, MAX_MPT_FIELD_LENGTHS.property_address, 'property_address'),
        city: parseLimitedString(city, MAX_MPT_FIELD_LENGTHS.city, 'city'),
        state: parseLimitedString(state, MAX_MPT_FIELD_LENGTHS.state, 'state'),
        zip: parseLimitedString(zip, MAX_MPT_FIELD_LENGTHS.zip, 'zip'),
        country: parseLimitedString(country, MAX_MPT_FIELD_LENGTHS.country, 'country'),
        property_type: parseLimitedString(property_type, MAX_MPT_FIELD_LENGTHS.property_type, 'property_type'),
        owner_name: parseLimitedString(owner_name, MAX_MPT_FIELD_LENGTHS.owner_name, 'owner_name'),
        owner_email: parseLimitedString(owner_email, MAX_MPT_FIELD_LENGTHS.owner_email, 'owner_email'),
      } as const;

      for (const field of Object.values(limited)) {
        if (field.error) {
          return new Response(JSON.stringify({ error: field.error }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const maxName = limited.name.value;
      const maxDescription = limited.description.value;
      const maxTicker = limited.ticker.value;
      const maxImageUrl = limited.image_url.value;
      const maxPropertyAddress = limited.property_address.value;
      const maxCity = limited.city.value;
      const maxState = limited.state.value;
      const maxZip = limited.zip.value;
      const maxCountry = limited.country.value;
      const maxPropertyType = limited.property_type.value;
      const maxOwnerName = limited.owner_name.value;
      const maxOwnerEmail = limited.owner_email.value;

      let mptFlags = 0;
      if (flags?.can_lock)      mptFlags |= 0x00000002;
      if (flags?.require_auth)  mptFlags |= 0x00000004;
      if (flags?.can_escrow)    mptFlags |= 0x00000008;
      if (flags?.can_trade)     mptFlags |= 0x00000010;
      if (flags?.can_transfer)  mptFlags |= 0x00000020;
      if (flags?.can_clawback)  mptFlags |= 0x00000040;

      txJson = {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: wallet_address,
        Flags: mptFlags,
        Fee: feeDrops,
      } as Record<string, unknown>;

      if (asset_scale !== undefined && asset_scale !== null) {
        txJson.AssetScale = Number(asset_scale);
      }
      if (max_amount) {
        txJson.MaximumAmount = String(max_amount);
      }

      // Build XLS-89 compliant MPTokenMetadata (max 1024 bytes)
      if (maxName || maxDescription) {
        const ptMap: Record<string, string> = {
          'Single Family': 'real_estate', 'Multi-Family': 'real_estate', 'Condo / Apartment': 'real_estate',
          'Townhouse': 'real_estate', 'Commercial': 'real_estate', 'Industrial': 'real_estate',
          'Land / Lot': 'real_estate', 'Mixed-Use': 'real_estate', 'Other': 'other',
        };

        const autoTicker = maxTicker || (maxName ? maxName.replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase() : undefined);

        const metaObj: Record<string, unknown> = {};
        if (autoTicker) metaObj.t = autoTicker;
        if (maxName) metaObj.n = maxName;
        if (maxDescription) metaObj.d = maxDescription;
        if (maxImageUrl) metaObj.i = maxImageUrl;
        metaObj.ac = 'rwa';
        metaObj.as = ptMap[maxPropertyType ?? ''] || 'real_estate';
        if (maxOwnerName) metaObj.in = maxOwnerName;

        if (uris && Array.isArray(uris) && uris.length > 0) {
          const validUris = uris.filter((u: unknown): u is UriEntry => {
            if (!u || typeof u !== 'object') return false;
            const entry = u as Partial<UriEntry>;
            return !!entry.u && !!entry.c && !!entry.t;
          });
          if (validUris.length > 0) {
            metaObj.us = validUris.map((u) => ({ u: u.u, c: u.c, t: u.t }));
          }
        }

        const ai: Record<string, unknown> = {};
        if (maxPropertyAddress) ai.address = maxPropertyAddress;
        if (maxCity) ai.city = maxCity;
        if (maxState) ai.state = maxState;
        if (maxZip) ai.zip = maxZip;
        if (maxCountry) ai.country = maxCountry;
        if (maxPropertyType) ai.property_type = maxPropertyType;
        if (bedrooms) ai.bedrooms = Number(bedrooms);
        if (bathrooms) ai.bathrooms = Number(bathrooms);
        if (square_feet) ai.sqft = Number(square_feet);
        if (year_built) ai.year_built = Number(year_built);
        if (estimated_value) ai.value_usd = Number(estimated_value);
        if (maxOwnerEmail) ai.contact = maxOwnerEmail;

        if (Object.keys(ai).length > 0) metaObj.ai = ai;

        // Enforce XRPL 1024-byte limit before returning tx JSON.
        const metaJson = JSON.stringify(metaObj);
        const metaBytes = new TextEncoder().encode(metaJson).length;
        if (metaBytes > 1024) {
          return new Response(JSON.stringify({
            error: 'MPToken metadata exceeds the 1024-byte XRPL limit. Shorten the inputs and try again.',
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        txJson.MPTokenMetadata = toHex(metaJson);
      }

      if (flags?.can_transfer && transfer_fee && Number(transfer_fee) > 0) {
        txJson.TransferFee = Number(transfer_fee);
      }

    } else {
      // IOU — TrustSet or Payment
      const { currency_code, amount, destination, step } = (params || {}) as Record<string, any>;
      const currencyResult = parseLimitedString(currency_code, MAX_MPT_FIELD_LENGTHS.currency_code, 'currency_code', true);
      const destinationResult = parseLimitedString(destination, MAX_MPT_FIELD_LENGTHS.destination, 'destination', true);

      if (currencyResult.error) {
        return new Response(JSON.stringify({ error: currencyResult.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (destinationResult.error) {
        return new Response(JSON.stringify({ error: destinationResult.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cleanCurrency = currencyResult.value!;
      const cleanDestination = destinationResult.value!;

      if (cleanCurrency.length < 3 || cleanCurrency.length > 20) {
        return new Response(JSON.stringify({ error: 'Currency code must be 3–20 characters.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // XRPL currency: 3-char standard, or 40-char hex (160-bit) for non-standard codes like "RLUSD"
      const normalizedCurrency = cleanCurrency.length === 3
        ? cleanCurrency.toUpperCase()
        : toHex(cleanCurrency.toUpperCase()).padEnd(40, '0').slice(0, 40);
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (step === 'trustset') {
        if (!cleanDestination || !isValidXRPLAddress(cleanDestination)) {
          return new Response(JSON.stringify({ error: 'Valid destination address required for TrustSet.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        txJson = {
          TransactionType: 'TrustSet',
          Account: cleanDestination,
          LimitAmount: {
            currency: normalizedCurrency,
            issuer: wallet_address,
            value: String(amount),
          },
          Fee: feeDrops,
        };
      } else {
        if (!cleanDestination || !isValidXRPLAddress(cleanDestination)) {
          return new Response(JSON.stringify({ error: 'Valid destination address required.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        txJson = {
          TransactionType: 'Payment',
          Account: wallet_address,
          Destination: cleanDestination,
          Amount: {
            currency: normalizedCurrency,
            issuer: wallet_address,
            value: String(amount),
          },
          Fee: feeDrops,
        };
      }
    }

    if (lastLedgerSequence > 0) {
      txJson.LastLedgerSequence = lastLedgerSequence;
    }

    console.log(`Built ${token_type} mint tx:`, JSON.stringify(txJson));

    return new Response(JSON.stringify({
      success: true,
      tx_json: txJson,
      token_type,
      network,
      fee_drops: feeDrops,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Build mint error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
