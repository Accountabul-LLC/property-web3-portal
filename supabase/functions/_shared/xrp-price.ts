const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'
const XRP_COIN_ID = 'ripple'
const XRPL_TIMESTAMP_DRIFT_WINDOW_SECONDS = 6 * 60 * 60

export type XrpUsdQuote = {
  price: number
  source: string
  quoted_at: string
  fetched_at: string
}

function parseUsdPrice(payload: any): number | null {
  const price = Number(payload?.ripple?.usd)
  return Number.isFinite(price) && price > 0 ? price : null
}

function toIsoFromUnixSeconds(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString()
}

async function fetchJson(url: string): Promise<any | null> {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  return await res.json()
}

export async function fetchCurrentXrpUsd(): Promise<XrpUsdQuote | null> {
  try {
    const payload = await fetchJson(`${COINGECKO_BASE_URL}/simple/price?ids=${XRP_COIN_ID}&vs_currencies=usd&include_last_updated_at=true`)
    const price = parseUsdPrice(payload)
    if (!price) return null

    const quotedAt = typeof payload?.ripple?.last_updated_at === 'number'
      ? toIsoFromUnixSeconds(payload.ripple.last_updated_at)
      : new Date().toISOString()

    return {
      price,
      source: 'coingecko-current',
      quoted_at: quotedAt,
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function fetchHistoricalXrpUsd(unixSeconds: number): Promise<XrpUsdQuote | null> {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return null

  const fetchedAt = new Date().toISOString()
  const from = Math.max(0, Math.floor(unixSeconds - XRPL_TIMESTAMP_DRIFT_WINDOW_SECONDS))
  const to = Math.floor(unixSeconds + XRPL_TIMESTAMP_DRIFT_WINDOW_SECONDS)

  try {
    const rangePayload = await fetchJson(
      `${COINGECKO_BASE_URL}/coins/${XRP_COIN_ID}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
    )

    const prices: [number, number][] = Array.isArray(rangePayload?.prices)
      ? rangePayload.prices
          .map((row: any) => [Number(row?.[0]), Number(row?.[1])] as [number, number])
          .filter((row: [number, number]) => Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[1] > 0)
      : []

    if (prices.length > 0) {
      let nearest = prices[0]
      let nearestDelta = Math.abs(prices[0][0] / 1000 - unixSeconds)

      for (const point of prices) {
        const delta = Math.abs(point[0] / 1000 - unixSeconds)
        if (delta < nearestDelta) {
          nearest = point
          nearestDelta = delta
        }
      }

      return {
        price: nearest[1],
        source: 'coingecko-range',
        quoted_at: new Date(nearest[0]).toISOString(),
        fetched_at: fetchedAt,
      }
    }
  } catch {
    // fall through to the daily history snapshot
  }

  try {
    const date = new Date(unixSeconds * 1000)
    const dd = String(date.getUTCDate()).padStart(2, '0')
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = date.getUTCFullYear()

    const historyPayload = await fetchJson(
      `${COINGECKO_BASE_URL}/coins/${XRP_COIN_ID}/history?date=${dd}-${mm}-${yyyy}&localization=false`,
    )
    const price = Number(historyPayload?.market_data?.current_price?.usd)
    if (!Number.isFinite(price) || price <= 0) return null

    return {
      price,
      source: 'coingecko-history',
      quoted_at: new Date(Date.UTC(yyyy, date.getUTCMonth(), date.getUTCDate())).toISOString(),
      fetched_at: fetchedAt,
    }
  } catch {
    return null
  }
}
