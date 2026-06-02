import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Globe,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  BadgeCheck,
  Phone,
  Mail,
  Building2,
  Store,
} from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { VendorLeadModal } from '@/components/vendor/VendorLeadModal'
import { getVendorPublicUrl, type VendorPublicProfileRecord } from '@/lib/vendorNetwork'
import NotFound from './NotFound'

export default function VendorPublicProfile() {
  const { slug } = useParams()
  const [leadOpen, setLeadOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor-public-profile', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data, error } = await ((supabase as any).from('vendor_public_profiles') as any)
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as VendorPublicProfileRecord | null
    },
    enabled: !!slug,
    staleTime: 60_000,
  })

  const fullAddress = useMemo(() => {
    if (!vendor) return ''
    return [
      vendor.business_address_city,
      vendor.business_address_state,
      vendor.business_address_zip,
    ]
      .filter(Boolean)
      .join(', ')
  }, [vendor])

  const mapsUrl = useMemo(() => {
    if (!fullAddress) return ''
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
  }, [fullAddress])

  const handleShare = async () => {
    if (!vendor) return
    const url = `${window.location.origin}${getVendorPublicUrl(vendor.slug)}`
    const text = `${vendor.company_name} on Accountabul`
    if (navigator.share) {
      try {
        await navigator.share({ title: vendor.company_name, text, url })
        return
      } catch {
        // fall back to copy
      }
    }
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }

  if (!slug) return <NotFound />
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto flex max-w-4xl items-center justify-center py-24 text-muted-foreground">Loading profile...</div>
        <Footer />
      </div>
    )
  }

  if (!vendor) return <NotFound />

  const title = `${vendor.company_name} | Accountabul Verified Vendor`
  const description = [vendor.profile_headline, vendor.business_address_city, vendor.business_address_state]
    .filter(Boolean)
    .join(' - ') || vendor.business_description || 'Verified vendor profile on Accountabul.'

  const isKycVerified = vendor.verification_status === 'verified'
  const isNetworkPartner = Boolean(vendor.verification_tier) || vendor.verification_status === 'verified'

  return (
    <div className="min-h-screen bg-background">
      <Seo title={title} description={description} path={`/vendor/${vendor.slug}`} />
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to="/vendors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to directory
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {shareStatus === 'copied' ? 'Copied link' : 'Share'}
            </Button>
            <Button onClick={() => setLeadOpen(true)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Contact
            </Button>
          </div>
        </div>

        {/* Hero header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
            {vendor.logo_url ? (
              <img src={vendor.logo_url} alt={vendor.company_name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{vendor.company_name}</h1>
            {vendor.profile_headline || vendor.industry_category ? (
              <p className="text-base text-muted-foreground">
                {vendor.profile_headline ?? vendor.industry_category}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isKycVerified ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-4 w-4" />
                  KYC Verified
                </span>
              ) : null}
              {isNetworkPartner ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  Verified Network Partner
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sidebar + main grid */}
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Side column: contact + details */}
          <aside className="space-y-6">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {fullAddress ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="leading-snug group-hover:underline">{fullAddress}</span>
                  </a>
                ) : null}
                {vendor.website_url ? (
                  <a
                    href={vendor.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="leading-snug group-hover:underline">
                      {vendor.website_url.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                ) : null}
                {vendor.business_email ? (
                  <a
                    href={`mailto:${vendor.business_email}`}
                    className="group flex items-start gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="leading-snug break-all group-hover:underline">{vendor.business_email}</span>
                  </a>
                ) : null}
                {vendor.business_phone ? (
                  <a
                    href={`tel:${vendor.business_phone}`}
                    className="group flex items-start gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="leading-snug group-hover:underline">{vendor.business_phone}</span>
                  </a>
                ) : null}
                {!fullAddress && !vendor.website_url && !vendor.business_email && !vendor.business_phone ? (
                  <p className="text-muted-foreground">This vendor has not shared public contact info yet.</p>
                ) : null}
                <Button className="w-full" onClick={() => setLeadOpen(true)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact vendor
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {vendor.business_description ?? 'No business description provided yet.'}
                </p>
                <dl className="grid gap-3 pt-2">
                  {vendor.industry_category ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Industry</dt>
                      <dd className="mt-0.5 font-medium">{vendor.industry_category}</dd>
                    </div>
                  ) : null}
                  {vendor.years_in_business ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Years in business</dt>
                      <dd className="mt-0.5 font-medium">{vendor.years_in_business}</dd>
                    </div>
                  ) : null}
                  {vendor.service_areas ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Service areas</dt>
                      <dd className="mt-0.5 font-medium">{vendor.service_areas}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </aside>

          {/* Main column: shop */}
          <section>
            <Card className="min-h-[420px] border-border/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">Shop</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse products and services offered by {vendor.company_name}.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/vendor/${vendor.slug}/shop`}>View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Store className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium">No products yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    This vendor hasn't listed any products. Once they publish their shop, items will appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <VendorLeadModal
        open={leadOpen}
        onOpenChange={setLeadOpen}
        vendorProfileId={vendor.id}
        vendorName={vendor.company_name}
        source="vendor_profile_page"
      />

      <Footer />
    </div>
  )
}
