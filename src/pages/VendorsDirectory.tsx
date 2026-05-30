import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users2,
  X,
} from 'lucide-react'
import { INDUSTRIES, US_STATES } from '@/lib/vendorCredentialCatalog'

interface PublicVendor {
  id: string
  slug: string
  company_name: string
  logo_url: string | null
  industry: string | null
  vendor_bio: string | null
  profile_headline: string | null
  business_address_city: string | null
  business_address_state: string | null
  verification_tier: string
  advertising_opt_in: boolean
}

const TIER_LABELS: Record<string, string> = {
  platform_vouched: 'Platform Vouched',
  credential_verified: 'Credential Verified',
  business_verified: 'Business Verified',
  unverified: 'Verified',
}

const TIER_ORDER = ['platform_vouched', 'credential_verified', 'business_verified', 'unverified']

function TierBadge({ tier, featured }: { tier: string; featured: boolean }) {
  if (tier === 'platform_vouched') {
    return (
      <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white">
        <Star className="w-3 h-3" />
        Platform Vouched
      </Badge>
    )
  }
  if (tier === 'credential_verified') {
    return (
      <Badge className="gap-1">
        <ShieldCheck className="w-3 h-3" />
        Credential Verified
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ShieldCheck className="w-3 h-3" />
      {featured ? 'Business Verified' : 'Verified'}
    </Badge>
  )
}

export default function VendorsDirectory() {
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')

  const { data: vendors = [], isLoading } = useQuery<PublicVendor[]>({
    queryKey: ['public-vendors-directory'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vendor_profiles')
        .select(
          'id, slug, company_name, logo_url, industry, vendor_bio, profile_headline, business_address_city, business_address_state, verification_tier, advertising_opt_in'
        )
        .eq('verification_status', 'verified')
        .eq('public_profile_enabled', true)
        .order('advertising_opt_in', { ascending: false })
        .order('company_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as PublicVendor[]
    },
    staleTime: 60_000,
  })

  const filtered = vendors.filter((v) => {
    const haystack = [
      v.company_name,
      v.vendor_bio ?? '',
      v.profile_headline ?? '',
      v.business_address_city ?? '',
      v.business_address_state ?? '',
    ]
      .join(' ')
      .toLowerCase()

    const matchesSearch = !search || haystack.includes(search.toLowerCase())
    const matchesIndustry = industryFilter === 'all' || v.industry === industryFilter
    const matchesState = stateFilter === 'all' || v.business_address_state === stateFilter
    const matchesTier = tierFilter === 'all' || v.verification_tier === tierFilter

    return matchesSearch && matchesIndustry && matchesState && matchesTier
  })

  // Sort: featured (advertising_opt_in) first, then by tier weight
  const sorted = [...filtered].sort((a, b) => {
    if (a.advertising_opt_in && !b.advertising_opt_in) return -1
    if (!a.advertising_opt_in && b.advertising_opt_in) return 1
    return TIER_ORDER.indexOf(a.verification_tier) - TIER_ORDER.indexOf(b.verification_tier)
  })

  const hasFilters = search || industryFilter !== 'all' || stateFilter !== 'all' || tierFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setIndustryFilter('all')
    setStateFilter('all')
    setTierFilter('all')
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Verified Vendors | Accountabul"
        description="Find verified real estate professionals on Accountabul — mortgage brokers, contractors, title companies, property managers, and more. Every vendor is manually reviewed."
        path="/vendors"
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3">Verified Vendor Network</Badge>
          <h1 className="text-4xl font-bold mb-3">Find a Verified Professional</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every vendor on Accountabul has been manually reviewed and approved. Browse by industry, location, or search by name.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/vendor">Join as a vendor</Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, specialty, or location..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i.slug} value={i.slug}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="All trust levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trust levels</SelectItem>
                <SelectItem value="platform_vouched">Platform Vouched</SelectItem>
                <SelectItem value="credential_verified">Credential Verified</SelectItem>
                <SelectItem value="business_verified">Business Verified</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-3 h-3" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          {isLoading ? 'Loading...' : `${sorted.length} verified vendor${sorted.length !== 1 ? 's' : ''}`}
          {hasFilters && !isLoading && ` matching your filters`}
        </p>

        {/* Vendor cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Users2 className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">
                {vendors.length === 0 ? 'No verified vendors yet' : 'No vendors match your filters'}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                {vendors.length === 0
                  ? 'Be the first verified vendor on Accountabul.'
                  : 'Try adjusting your search or clearing the filters.'}
              </p>
              {vendors.length === 0 && (
                <Button asChild>
                  <Link to="/vendor">Join as a vendor</Link>
                </Button>
              )}
              {hasFilters && vendors.length > 0 && (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((vendor) => {
              const industryLabel = INDUSTRIES.find((i) => i.slug === vendor.industry)?.label ?? vendor.industry
              const location = [vendor.business_address_city, vendor.business_address_state]
                .filter(Boolean)
                .join(', ')

              return (
                <Card
                  key={vendor.id}
                  className={`flex flex-col transition-shadow hover:shadow-md ${
                    vendor.advertising_opt_in ? 'border-primary/30' : ''
                  }`}
                >
                  <CardContent className="pt-5 flex flex-col gap-3 flex-1">
                    {/* Logo + name */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 border border-border/50">
                        {vendor.logo_url ? (
                          <img
                            src={vendor.logo_url}
                            alt={vendor.company_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug truncate">{vendor.company_name}</h3>
                        {industryLabel && (
                          <p className="text-xs text-muted-foreground truncate">{industryLabel}</p>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <TierBadge tier={vendor.verification_tier} featured={vendor.advertising_opt_in} />
                      {vendor.advertising_opt_in && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Star className="w-2.5 h-2.5" />
                          Featured
                        </Badge>
                      )}
                    </div>

                    {/* Headline / bio */}
                    {(vendor.profile_headline || vendor.vendor_bio) && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {vendor.profile_headline || vendor.vendor_bio}
                      </p>
                    )}

                    {/* Location */}
                    {location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {location}
                      </div>
                    )}

                    {/* CTAs */}
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button asChild size="sm" className="flex-1">
                        <Link to={`/vendor/${vendor.slug}`}>View Profile</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to={`/vendor/${vendor.slug}?contact=1`}>Contact</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
