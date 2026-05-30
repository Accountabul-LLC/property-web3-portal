import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, Search, MessageCircle, Star, ShieldCheck, ArrowRight, Globe } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { getVendorPublicUrl, getVendorTierLabel, type VendorPublicProfileRecord } from '@/lib/vendorNetwork'
import { US_STATES, VENDOR_INDUSTRIES } from '@/lib/vendorCatalog'
import { VendorLeadModal } from '@/components/vendor/VendorLeadModal'

export default function VendorsDirectory() {
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('All')
  const [state, setState] = useState('All')
  const [tier, setTier] = useState('All')
  const [contactVendor, setContactVendor] = useState<VendorPublicProfileRecord | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vendors-directory'],
    queryFn: async () => {
      const { data, error } = await ((supabase as any).from('vendor_public_profiles') as any)
        .select('*')
        .order('company_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as VendorPublicProfileRecord[]
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data ?? []).filter((vendor) => {
      const searchable = [
        vendor.company_name,
        vendor.profile_headline ?? '',
        vendor.business_description ?? '',
        vendor.business_address_city ?? '',
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || searchable.includes(term)
      const matchesIndustry = industry === 'All' || (vendor.industry_category ?? '').toLowerCase() === industry.toLowerCase()
      const matchesState = state === 'All' || (vendor.business_address_state ?? '').toLowerCase() === state.toLowerCase()
      const matchesTier = tier === 'All' || vendor.verification_tier === tier
      return matchesSearch && matchesIndustry && matchesState && matchesTier
    })
  }, [data, search, industry, state, tier])

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Verified Vendors Directory | Accountabul"
        description="Browse verified vendors on Accountabul, filter by industry, and contact approved businesses directly."
        path="/vendors"
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Public verified vendor network
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Verified Vendors</h1>
            <p className="max-w-2xl text-muted-foreground">
              Browse approved vendors, filter by industry and state, and contact a business directly from its public profile.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/auth/vendor">
              Be the first verified vendor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Search and filters</CardTitle>
            <CardDescription>Search by company, headline, description, or city.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors..."
                className="pl-10"
              />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All industries</SelectItem>
                {VENDOR_INDUSTRIES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All states</SelectItem>
                {US_STATES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="xl:col-span-2">
                <SelectValue placeholder="Verification tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All tiers</SelectItem>
                <SelectItem value="business_verified">Business Verified</SelectItem>
                <SelectItem value="credential_verified">Credential Verified</SelectItem>
                <SelectItem value="platform_vouched">Platform Vouched</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="mt-8">
          {isLoading ? (
            <div className="rounded-2xl border p-8 text-center text-muted-foreground">Loading vendors...</div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Star className="mb-3 h-8 w-8 text-primary" />
                <h2 className="text-xl font-semibold">Be the first verified vendor</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  No verified vendors match the current filters yet. Apply to join the network and appear here once approved.
                </p>
                <Button asChild className="mt-6">
                  <Link to="/auth/vendor">Apply as a vendor</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((vendor) => (
                <Card key={vendor.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                          {vendor.logo_url ? (
                            <img src={vendor.logo_url} alt={vendor.company_name} className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{vendor.company_name}</CardTitle>
                          <CardDescription className="line-clamp-1">
                            {vendor.profile_headline ?? vendor.industry_category ?? 'Verified vendor'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">{getVendorTierLabel(vendor.verification_tier)}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {vendor.business_address_city ?? 'Unknown'}, {vendor.business_address_state ?? 'US'}
                      </span>
                      {vendor.industry_category ? (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {vendor.industry_category}
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {vendor.business_description ?? 'No business description provided yet.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={getVendorPublicUrl(vendor.slug)}>
                          View Profile
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => setContactVendor(vendor)}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Contact
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {contactVendor && (
        <VendorLeadModal
          open={!!contactVendor}
          onOpenChange={(open) => !open && setContactVendor(null)}
          vendorProfileId={contactVendor.id}
          vendorName={contactVendor.company_name}
        />
      )}

      <Footer />
    </div>
  )
}
