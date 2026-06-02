import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface VendorProduct {
  id: string
  vendor_profile_id: string
  name: string
  description: string | null
  price_cents: number | null
  currency: string
  image_url: string | null
  category: string | null
  is_published: boolean
  sort_order: number
  created_at: string
}

export function useVendorProducts(vendorProfileId: string | null | undefined, opts?: { limit?: number }) {
  const limit = opts?.limit
  return useQuery<VendorProduct[]>({
    queryKey: ['vendor-products', vendorProfileId, limit ?? null],
    queryFn: async () => {
      if (!vendorProfileId) return []
      let q = (supabase.from('vendor_products' as any) as any)
        .select('*')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (limit) q = q.limit(limit)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as VendorProduct[]
    },
    enabled: !!vendorProfileId,
    staleTime: 30_000,
  })
}

export function formatProductPrice(p: Pick<VendorProduct, 'price_cents' | 'currency'>) {
  if (p.price_cents == null) return 'Contact for pricing'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'USD' }).format(
      p.price_cents / 100,
    )
  } catch {
    return `$${(p.price_cents / 100).toFixed(2)}`
  }
}
