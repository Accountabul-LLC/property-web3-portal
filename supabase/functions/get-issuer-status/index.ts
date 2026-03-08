/**
 * get-issuer-status  (admin / compliance officer only)
 *
 * Returns metadata + live XRPL account info for the active issuer wallet.
 * Used by the admin Credential panel to show issuer health.
 *
 * Body: { network?: 'testnet' | 'mainnet' }  (defaults to 'testnet')
 *
 * Returns: {
 *   issuer_id, issuer_name, issuer_address, environment, network, status,
 *   secret_env_key,          ← key name only, never the actual secret
 *   seed_configured: boolean ← true if Deno.env.get(secret_env_key) is set
 *   last_used_at,
 *   xrpl: {
 *     found: boolean
 *     balance_xrp?: string
 *     sequence?: number
 *     account_flags?: number
 *   }
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com']

async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  for (const node of nodes) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
      })
      const text = await res.text()
      return JSON.parse(text)
    } catch {
      // try next node
    }
  }
  throw new Error('All XRPL nodes failed')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const network: string = body.network ?? 'testnet'

    // ── Fetch issuer from DB ─────────────────────────────────
    const { data: issuer, error: issuerError } = await serviceClient
      .from('xrpl_issuer_wallets')
      .select('id, issuer_name, issuer_address, environment, network, status, secret_env_key, last_used_at, created_at')
      .eq('network', network)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (issuerError) throw issuerError

    if (!issuer) {
      return new Response(JSON.stringify({
        found: false,
        network,
        message: `No active issuer wallet found for network '${network}'. Register one in the admin panel.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // ── Check seed is configured (key name only) ─────────────
    const seedConfigured = !!Deno.env.get(issuer.secret_env_key)

    // ── Fetch live XRPL account info ─────────────────────────
    let xrplInfo: Record<string, unknown> = { found: false }
    try {
      const nodes = TESTNET_NODES // Phase 1A: testnet only
      const accountInfo = await xrplRequest(nodes, 'account_info', [
        { account: issuer.issuer_address, ledger_index: 'validated' },
      ])
      if (accountInfo.result?.error) {
        xrplInfo = { found: false, error: accountInfo.result.error }
      } else {
        const accountData = accountInfo.result?.account_data
        xrplInfo = {
          found: true,
          balance_xrp: accountData?.Balance
            ? (Number(accountData.Balance) / 1_000_000).toFixed(6)
            : '0',
          sequence: accountData?.Sequence,
          account_flags: accountData?.Flags,
        }
      }
    } catch (xrplErr) {
      xrplInfo = { found: false, error: String(xrplErr) }
    }

    return new Response(JSON.stringify({
      issuer_id: issuer.id,
      issuer_name: issuer.issuer_name,
      issuer_address: issuer.issuer_address,
      environment: issuer.environment,
      network: issuer.network,
      status: issuer.status,
      secret_env_key: issuer.secret_env_key,
      seed_configured: seedConfigured,
      last_used_at: issuer.last_used_at,
      created_at: issuer.created_at,
      xrpl: xrplInfo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in get-issuer-status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
