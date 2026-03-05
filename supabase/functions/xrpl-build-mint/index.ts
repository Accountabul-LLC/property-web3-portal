import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getXRPLNode(network: string): string {
  return network === 'testnet'
    ? 'https://s.altnet.rippletest.net:51234'
    : 'https://xrplcluster.com';
}

async function xrplRequest(node: string, method: string, params: Record<string, unknown>[]) {
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  return res.json();
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

    // Validate basics
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
    if (!wallet_address || !isValidXRPLAddress(wallet_address)) {
      return new Response(JSON.stringify({ error: 'Invalid wallet address.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

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

    // Get XRPL node and fetch account info
    const node = getXRPLNode(network);
    const [accountInfoRes, serverInfoRes] = await Promise.all([
      xrplRequest(node, 'account_info', [{ account: wallet_address, ledger_index: 'validated' }]),
      xrplRequest(node, 'server_info', [{}]),
    ]);

    if (accountInfoRes.result?.error === 'actNotFound') {
      return new Response(JSON.stringify({ error: 'Account not found on XRPL. Fund it first on testnet.' }), {
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
      // NFTokenMint
      const { uri, flags } = params || {};
      if (!uri || typeof uri !== 'string') {
        return new Response(JSON.stringify({ error: 'URI is required for NFT minting.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build NFT flags
      let nftFlags = 0;
      if (flags?.transferable) nftFlags |= 0x00000008; // tfTransferable
      if (flags?.burnable) nftFlags |= 0x00000001;     // tfBurnable
      if (flags?.onlyXRP) nftFlags |= 0x00000002;      // tfOnlyXRP

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
      if (flags?.can_lock)      mptFlags |= 0x00000002;  // tfMPTCanLock
      if (flags?.require_auth)  mptFlags |= 0x00000004;  // tfMPTRequireAuth
      if (flags?.can_escrow)    mptFlags |= 0x00000008;  // tfMPTCanEscrow
      if (flags?.can_trade)     mptFlags |= 0x00000010;  // tfMPTCanTrade
      if (flags?.can_transfer)  mptFlags |= 0x00000020;  // tfMPTCanTransfer
      if (flags?.can_clawback)  mptFlags |= 0x00000040;  // tfMPTCanClawback

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

      // Build MPTokenMetadata from name + description
      if (name || description) {
        const metaObj: Record<string, string> = {};
        if (name) metaObj.name = name;
        if (description) metaObj.description = description;
        txJson.MPTokenMetadata = toHex(JSON.stringify(metaObj));
      }

      // TransferFee only valid when can_transfer is set
      if (flags?.can_transfer && transfer_fee && Number(transfer_fee) > 0) {
        txJson.TransferFee = Number(transfer_fee);
      }

    } else {
      // IOU — TrustSet (step 1) or Payment (step 2)
      const { currency_code, amount, destination, step } = params || {};

      if (!currency_code || typeof currency_code !== 'string' || currency_code.length < 3 || currency_code.length > 3) {
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
        // Destination sets trust line TO the issuer (wallet_address)
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
        // Payment — issuer sends currency to destination
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

    // Add common fields
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
