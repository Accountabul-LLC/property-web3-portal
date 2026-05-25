import { Client, Wallet } from 'npm:xrpl@3.1.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const NODES: Record<string, string> = {
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const network = (url.searchParams.get('network') || 'testnet') as keyof typeof NODES
    const wsUrl = NODES[network]
    if (!wsUrl) throw new Error(`Unsupported network: ${network}`)

    const seed =
      Deno.env.get(`CAMPAIGN_RELEASE_SIGNER_SEED_${network.toUpperCase()}`) ||
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_SEED')
    if (!seed) throw new Error('CAMPAIGN_RELEASE_SIGNER_SEED not set')
    const algo = (Deno.env.get(`CAMPAIGN_RELEASE_SIGNER_ALGORITHM_${network.toUpperCase()}`) ||
      Deno.env.get('CAMPAIGN_RELEASE_SIGNER_ALGORITHM') ||
      'secp256k1') as 'ed25519' | 'secp256k1'

    const wallet = Wallet.fromSeed(seed, { algorithm: algo })
    const client = new Client(wsUrl)
    await client.connect()
    const result = await client.fundWallet(wallet)
    await client.disconnect()

    return new Response(
      JSON.stringify({
        network,
        address: wallet.classicAddress,
        balance: result.balance,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
