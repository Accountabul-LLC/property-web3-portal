import { Wallet } from 'npm:xrpl@3.1.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = createClient(supabaseUrl, supabaseAnonKey)
    const svc = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await anon.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const network = (url.searchParams.get('network') || 'testnet').toUpperCase()
    const seedEnvKey = `CAMPAIGN_RELEASE_SIGNER_SEED_${network}`
    const seedConfigured = !!(Deno.env.get(seedEnvKey) ?? Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED'))
    const algorithm =
      Deno.env.get(`CAMPAIGN_RELEASE_SIGNER_ALGORITHM_${network}`) ??
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_ALGORITHM') ??
      'secp256k1'
    const seed =
      Deno.env.get(seedEnvKey) ||
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')

    if (!seedConfigured || !seed) {
      return new Response(JSON.stringify({
        network: network.toLowerCase(),
        configured: false,
        error: 'Signer not configured',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const wallet = Wallet.fromSeed(seed, { algorithm: algorithm as 'ed25519' | 'secp256k1' })
    return new Response(JSON.stringify({
      network: network.toLowerCase(),
      configured: true,
      algorithm,
      address: wallet.classicAddress,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
