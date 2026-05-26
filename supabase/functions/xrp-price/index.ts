import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { Client } from 'npm:xrpl@3.1.0'
import { fetchCurrentXrpUsd } from '../_shared/xrp-price.ts'

// Ripple's official RLUSD issuer (mainnet)
const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
const RLUSD_HEX = '524C555344000000000000000000000000000000' // "RLUSD"

async function fromXrplRlusd(): Promise<number | null> {
  const nodes = ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com']
  for (const url of nodes) {
    const client = new Client(url, { connectionTimeout: 5000 })
    try {
      await client.connect()
      // Best offer to BUY RLUSD with XRP -> price = RLUSD per XRP (~ USD per XRP)
      const book: any = await client.request({
        command: 'book_offers',
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: RLUSD_HEX, issuer: RLUSD_ISSUER },
        limit: 1,
      })
      const offer = book?.result?.offers?.[0]
      if (offer) {
        const xrpDrops = Number(typeof offer.TakerGets === 'string' ? offer.TakerGets : offer.TakerGets?.value)
        const rlusd = Number(offer.TakerPays?.value)
        const xrp = xrpDrops / 1_000_000
        if (xrp > 0 && rlusd > 0) return rlusd / xrp
      }
    } catch (_) {
      // try next node
    } finally {
      try { await client.disconnect() } catch {}
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const current = await fetchCurrentXrpUsd()
    let price = current?.price ?? null
    let source = 'coingecko'
    if (!price) {
      price = await fromXrplRlusd()
      source = 'xrpl-rlusd'
    }
    if (!price) {
      return new Response(JSON.stringify({ error: 'price_unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ price, source, ts: Date.now() }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
