import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VendorLeadModal } from '@/components/vendor/VendorLeadModal'
import { INDUSTRIES, CREDENTIAL_CATALOG } from '@/lib/vendorCredentialCatalog'
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Users2,
} from 'lucide-react'
import { toast } from 'sonner'

interface PublicVendorProfile {
  id: string
  slug: string
  company_name: string
  logo_url: string | null
  industry: string | null
  vendor_bio: string | null
  profile_headline: string | null
  business_email: string | null
  business_phone: string | null
  website_url: string | null
  business_address_city: string | null
  business_address_state: string | null
  business_address_zip: string | null
  years_in_business: number | null
  verification_tier: string
  advertising_opt_in: boolean
}

interface PublicCredential {
  id: string
  credential_type: string
  credential_number: string
  issuing_state: string | null
  expires_on: string | null
  verification_status: string
}

const TIER_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck }> = {
  platform_vouched: { label: 'Platform Vouched', icon: Star },
  credential_verified: { label: 'Credential Verified', icon: ShieldCheck },
  business_verified: { label: 'Business Verified', icon: ShieldCheck },
  unverified: { label: 'Verified', icon: ShieldCheck },
}

export default function VendorPublicProfile() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [contactOpen, setContactOpen] = useState(searchParams.get('contact') === '1')

  // Remove ?contact=1 from URL after modal opens
  useEffect(() => {
    if (searchParams.get('contact') === '1') {
      setContactOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: vendor, isLoading, isError } = useQuery<PublicVendorProfile | null>({
    queryKey: ['public-vendor-profile', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data, error } = await (supabase as any)
        .from('vendor_profiles')
        .select(
          'id, slug, company_name, logo_url, industry, vendor_bio, profile_headline, business_email, business_phone, website_url, business_address_city, business_address_state, business_address_zip, years_in_business, verification_tier, advertising_opt_in'
        )
        .eq('slug', slug)
        .eq('verification_status', 'verified')
        .eq('public_profile_enabled', true)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as PublicVendorProfile | null
    },
    enabled: !!slug,
    staleTime: 60_000,
  })

  const { data: credentials = [] } = useQuery<PublicCredential[]>({
    queryKey: ['public-vendor-credentials', vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return []
      const { data, error } = await (supabase as any)
        .from('vendor_credentials')
        .select('id, credential_type, credential_number, issuing_state, expires_on, verification_status')
        .eq('vendor_profile_id', vendor.id)
        .eq('verification_status', 'verified')
        .order('created_at', { ascending: true })
      if (error) return []
      return (data ?? []) as PublicCredential[]
    },
    enabled: !!vendor?.id,
    staleTime: 60_000,
  })

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: vendor?.company_name ?? 'Verified Vendor',
          text: vendor?.profile_headline ?? `Check out ${vendor?.company_name} on Accountabul`,
          url,
        })
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Profile link copied to clipboard')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-xl bg-muted" />
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            </div>
            <div className="h-24 bg-muted rounded" />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="min-h-screen bg-background">
        <Seo title="Vendor Not Found | Accountabul" description="" path={`/vendor/${slug}`} noindex />
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Vendor not found</h1>
          <p className="text-muted-foreground">
            This profile may have been removed or is not publicly available.
          </p>
          <Button asChild variant="outline">
            <Link to="/vendors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to vendor directory
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    )
  }

  const industryLabel = INDUSTRIES.find((i) => i.slug === vendor.industry)?.label ?? vendor.industry
  const location = [vendor.business_address_city, vendor.business_address_state, vendor.business_address_zip]
    .filter(Boolean)
    .join(', ')
  const tierConfig = TIER_CONFIG[vendor.verification_tier] ?? TIER_CONFIG.unverified
  const TierIcon = tierConfig.icon

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${vendor.company_name} | Accountabul Verified Vendor`}
        description={vendor.profile_headline ?? vendor.vendor_bio ?? `${vendor.company_name} is a verified vendor on Accountabul.`}
        path={`/vendor/${vendor.slug}`}
      />
      <Navigation />

      {vendor && (
        <VendorLeadModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          vendorProfileId={vendor.id}
          vendorName={vendor.company_name}
        />
      )}

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* Back link */}
        <Link
          to="/vendors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Vendor directory
        </Link>

        {/* Hero card */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Logo */}
              <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 border border-border/50">
                {vendor.logo_url ? (
                  <img src={vendor.logo_url} alt={vendor.company_name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              {/* Name + badges + actions */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-2 mb-2">
                  <h1 className="text-2xl font-bold leading-tight">{vendor.company_name}</h1>
                  {vendor.advertising_opt_in && (
                    <Badge variant="outline" className="gap-1">
                      <Star className="w-3 h-3" />
                      Featured
                    </Badge>
                  )}
                </div>

                {/* Trust tier badge */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {vendor.verification_tier === 'platform_vouched' ? (
                    <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white">
                      <TierIcon className="w-3 h-3" />
                      {tierConfig.label}
                    </Badge>
                  ) : (
                    <Badge className="gap-1">
                      <TierIcon className="w-3 h-3" />
                      {tierConfig.label}
                    </Badge>
                  )}
                  {industryLabel && (
                    <Badge variant="secondary">{industryLabel}</Badge>
                  )}
                </div>

                {vendor.profile_headline && (
                  <p className="text-muted-foreground">{vendor.profile_headline}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={() => setContactOpen(true)} size="sm">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            <Separator />

            {/* Quick info row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {location}
                </span>
              )}
              {vendor.business_phone && (
                <a href={`tel:${vendor.business_phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {vendor.business_phone}
                </a>
              )}
              {vendor.business_email && (
                <a href={`mailto:${vendor.business_email}`} className="flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {vendor.business_email}
                </a>
              )}
              {vendor.website_url && (
                <a
                  href={vendor.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-foreground"
                >
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  Website
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {vendor.years_in_business && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  {vendor.years_in_business} years in business
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* About */}
            {vendor.vendor_bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {vendor.vendor_bio}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Credentials */}
            {credentials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Verified Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {credentials.map((c) => {
                      const def = CREDENTIAL_CATALOG[c.credential_type]
                      return (
                        <div
                          key={c.id}
                          className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{def?.label ?? c.credential_type}</p>
                            <Badge variant="default" className="text-[10px]">Verified</Badge>
                          </div>
                          {c.issuing_state && (
                            <p className="text-xs text-muted-foreground">State: {c.issuing_state}</p>
                          )}
                          {c.expires_on && (
                            <p className="text-xs text-muted-foreground">
                              Expires {new Date(c.expires_on).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — contact card */}
          <div className="space-y-4">
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">Get in touch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Send {vendor.company_name} a message directly through Accountabul.
                </p>
                <Button className="w-full" onClick={() => setContactOpen(true)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Contact {vendor.company_name.split(' ')[0]}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share this profile
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Accountabul Verified
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Manually reviewed and approved by our team</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Real estate professional network</span>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Link to="/vendors" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Browse all vendors
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
