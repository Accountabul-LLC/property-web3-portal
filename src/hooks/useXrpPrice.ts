import { useQuery } from '@tanstack/react-query'

export function useXrpPrice() {
  return useQuery({
    queryKey: ['xrp-usd-price'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd'
      )
      if (!res.ok) throw new Error('Failed to fetch XRP price')
      const json = await res.json()
      return Number(json?.ripple?.usd) || 0
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n)
}
