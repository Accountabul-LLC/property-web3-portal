import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { fetchHistoricalXrpUsd } from '../_shared/xrp-price.ts'

type RequestBody = {
  timestamps?: Array<string | number>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as RequestBody
    const timestamps = Array.isArray(body?.timestamps) ? body.timestamps : []

    const uniqueTimestamps = Array.from(
      new Set(
        timestamps
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    ).sort((a, b) => a - b)

    const quotes: Record<string, {
      price: number
      source: string
      quoted_at: string
      fetched_at: string
    }> = {}

    for (const ts of uniqueTimestamps) {
      const quote = await fetchHistoricalXrpUsd(ts)
      if (!quote) continue
      quotes[String(ts)] = quote
    }

    return new Response(JSON.stringify({ quotes }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
