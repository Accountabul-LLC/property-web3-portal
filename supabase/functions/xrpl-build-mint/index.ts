import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAINNET_NODES = ['https://s2.ripple.com:51234', 'https://s1.ripple.com:51234', 'https://xrplcluster.com'];
const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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

function isValidXRPLAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token_type, network, wallet_address, params } = await req.json();

    if (!token_type || !['nft', 'mpt', 'iou'].includes(token_type)) {
      return new Response(JSON.stringify({ error: 'Invalid token_type. Must be nft, mpt, or iou.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!network || !['testnet', 'mainnet'].includes(network)) {
      return new Response(JSON.stringify({ error: 'Invalid network.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      const { uri, flags } = params || {};
      if (!uri || typeof uri !== 'string') {
        return new Response(JSON.stringify({ error: 'URI is required for NFT minting.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let nftFlags = 0;
      if (flags?.transferable) nftFlags |= 0x00000008;
      if (flags?.burnable) nftFlags |= 0x00000001;
      if (flags?.onlyXRP) nftFlags |= 0x00000002;

      txJson = {
        TransactionType: 'NFTokenMint',
        Account: wallet_address,
        URI: toHex(uri),
        Flags: nftFlags,
        NFTokenTaxon: 0,
        Fee: feeDrops,
      };

    } else if (token_type === 'mpt') {
      // MPTokenIssuanceCreate
      const { name, description, max_amount, asset_scale, transfer_fee, flags } = params || {};

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
      if (name || description) {
        const { ticker, property_address, city, state, zip, country, property_type, bedrooms, bathrooms, square_feet, year_built, estimated_value, owner_name, owner_email, image_url, uris } = params || {};

        const ptMap: Record<string, string> = {
          'Single Family': 'real_estate', 'Multi-Family': 'real_estate', 'Condo / Apartment': 'real_estate',
          'Townhouse': 'real_estate', 'Commercial': 'real_estate', 'Industrial': 'real_estate',
          'Land / Lot': 'real_estate', 'Mixed-Use': 'real_estate', 'Other': 'other',
        };

        const autoTicker = ticker || (name ? name.replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase() : undefined);

        const metaObj: Record<string, unknown> = {};
        if (autoTicker) metaObj.t = autoTicker;
        if (name) metaObj.n = name;
        if (description) metaObj.d = description;
        if (image_url) metaObj.i = image_url;
        metaObj.ac = 'rwa';
        metaObj.as = ptMap[property_type] || 'real_estate';
        if (owner_name) metaObj.in = owner_name;

        if (uris && Array.isArray(uris) && uris.length > 0) {
          const validUris = uris.filter((u: any) => u.u && u.c && u.t);
          if (validUris.length > 0) {
            metaObj.us = validUris.map((u: any) => ({ u: u.u, c: u.c, t: u.t }));
          }
        }

        const ai: Record<string, unknown> = {};
        if (property_address) ai.address = property_address;
        if (city) ai.city = city;
        if (state) ai.state = state;
        if (zip) ai.zip = zip;
        if (country) ai.country = country;
        if (property_type) ai.property_type = property_type;
        if (bedrooms) ai.bedrooms = Number(bedrooms);
        if (bathrooms) ai.bathrooms = Number(bathrooms);
        if (square_feet) ai.sqft = Number(square_feet);
        if (year_built) ai.year_built = Number(year_built);
        if (estimated_value) ai.value_usd = Number(estimated_value);
        if (owner_email) ai.contact = owner_email;

        if (Object.keys(ai).length > 0) metaObj.ai = ai;

        // Enforce XRPL 1024-byte limit
        let metaJson = JSON.stringify(metaObj);
        let metaBytes = new TextEncoder().encode(metaJson).length;
        if (metaBytes > 1024) {
          console.warn(`Metadata ${metaBytes} bytes, trimming to fit 1024 limit`);
          if (metaObj.d) {
            metaObj.d = (metaObj.d as string).substring(0, 60) + '…';
            metaJson = JSON.stringify(metaObj);
            metaBytes = new TextEncoder().encode(metaJson).length;
          }
          if (metaBytes > 1024) {
            delete metaObj.us;
            metaJson = JSON.stringify(metaObj);
            metaBytes = new TextEncoder().encode(metaJson).length;
          }
          if (metaBytes > 1024) {
            delete metaObj.i;
            metaJson = JSON.stringify(metaObj);
            metaBytes = new TextEncoder().encode(metaJson).length;
          }
          if (metaBytes > 1024 && metaObj.ai) {
            const aiObj = metaObj.ai as Record<string, unknown>;
            for (const key of ['contact', 'country', 'zip', 'address', 'city', 'state']) {
              delete aiObj[key];
              metaJson = JSON.stringify(metaObj);
              if (new TextEncoder().encode(metaJson).length <= 1024) break;
            }
          }
          metaJson = JSON.stringify(metaObj);
          console.log(`Trimmed metadata to ${new TextEncoder().encode(metaJson).length} bytes`);
        }

        txJson.MPTokenMetadata = toHex(metaJson);
      }

      if (flags?.can_transfer && transfer_fee && Number(transfer_fee) > 0) {
        txJson.TransferFee = Number(transfer_fee);
      }

    } else {
      // IOU — TrustSet or Payment
      const { currency_code, amount, destination, step } = params || {};

      if (!currency_code || typeof currency_code !== 'string' || currency_code.length !== 3) {
        return new Response(JSON.stringify({ error: 'Currency code must be exactly 3 characters.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (step === 'trustset') {
        if (!destination || !isValidXRPLAddress(destination)) {
          return new Response(JSON.stringify({ error: 'Valid destination address required for TrustSet.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        txJson = {
          TransactionType: 'TrustSet',
          Account: destination,
          LimitAmount: {
            currency: currency_code.toUpperCase(),
            issuer: wallet_address,
            value: String(amount),
          },
          Fee: feeDrops,
        };
      } else {
        if (!destination || !isValidXRPLAddress(destination)) {
          return new Response(JSON.stringify({ error: 'Valid destination address required.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        txJson = {
          TransactionType: 'Payment',
          Account: wallet_address,
          Destination: destination,
          Amount: {
            currency: currency_code.toUpperCase(),
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
