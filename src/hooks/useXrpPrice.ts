import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useXrpPrice() {
  return useQuery({
    queryKey: ['xrp-usd-price'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('xrp-price')
      if (error) throw error
      const n = Number((data as any)?.price)
      if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid XRP price')
      return n
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n)
}
