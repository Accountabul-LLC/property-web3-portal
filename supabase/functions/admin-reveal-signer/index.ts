import { Wallet } from 'npm:xrpl@3.1.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const network = (url.searchParams.get('network') || 'testnet').toUpperCase()
    const seed =
      Deno.env.get(`CAMPAIGN_RELEASE_SIGNER_SEED_${network}`) ||
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')
    const algo = (Deno.env.get(`CAMPAIGN_RELEASE_SIGNER_ALGORITHM_${network}`) ||
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_ALGORITHM') ||
      'secp256k1') as 'ed25519' | 'secp256k1'
    if (!seed) throw new Error('Seed not configured')
    const wallet = Wallet.fromSeed(seed, { algorithm: algo })
    return new Response(
      JSON.stringify({ network: network.toLowerCase(), seed, algorithm: algo, address: wallet.classicAddress }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
