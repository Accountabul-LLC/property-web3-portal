import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Globe,
  MapPin,
  MessageCircle,
  Share2,
  BadgeCheck,
  Phone,
  Mail,
  Building2,
  Package,
} from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { supabase } from '@/integrations/supabase/client'
import { VendorLeadModal } from '@/components/vendor/VendorLeadModal'
import VendorPublicSidebar from '@/components/vendor/VendorPublicSidebar'
import { getVendorPublicUrl, type VendorPublicProfileRecord } from '@/lib/vendorNetwork'
import { useVendorProducts, formatProductPrice } from '@/hooks/useVendorProducts'
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

  const { data: products = [] } = useVendorProducts(vendor?.id, { limit: 6 })

  const fullAddress = useMemo(() => {
    if (!vendor) return ''
    return [vendor.business_address_city, vendor.business_address_state, vendor.business_address_zip]
      .filter(Boolean)
      .join(', ')
  }, [vendor])

  const mapsUrl = useMemo(() => {
    if (!fullAddress) return ''
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
  }, [fullAddress])

  const memberSince = useMemo(() => {
    if (!vendor?.created_at) return null
    try {
      return new Date(vendor.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    } catch {
      return null
    }
  }, [vendor])

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <VendorPublicSidebar />
        <SidebarInset>
          {vendor ? (
            <Seo
              title={`${vendor.company_name} | Accountabul Verified Vendor`}
              description={
                [vendor.profile_headline, vendor.business_address_city, vendor.business_address_state]
                  .filter(Boolean)
                  .join(' - ') ||
                vendor.business_description ||
                'Verified vendor profile on Accountabul.'
              }
              path={`/vendor/${vendor.slug}`}
            />
          ) : null}

          {/* Top bar */}
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Button variant="ghost" size="sm" asChild>
                <Link to="/vendors">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to directory
                </Link>
              </Button>
            </div>
            {vendor ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  {shareStatus === 'copied' ? 'Copied' : 'Share'}
                </Button>
                <Button size="sm" onClick={() => setLeadOpen(true)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact
                </Button>
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground">Loading profile...</div>
            ) : !vendor ? (
              <NotFound />
            ) : (
              <div className="mx-auto max-w-6xl">
                {/* Hero header */}
                <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
                    {vendor.logo_url ? (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.company_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{vendor.company_name}</h1>
                    {vendor.industry_category ? (
                      <p className="text-base text-muted-foreground">{vendor.industry_category}</p>
                    ) : null}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        <BadgeCheck className="h-4 w-4" />
                        Verified Network Partner
                      </span>
                    </div>
                    {vendor.business_description ? (
                      <p className="max-w-2xl pt-2 text-sm leading-relaxed text-muted-foreground">
                        {vendor.business_description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Body grid */}
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  {/* Left column */}
                  <aside className="space-y-6">
                    <Card className="border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        {fullAddress ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-2.5 text-foreground transition-colors hover:text-primary"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="leading-snug group-hover:underline">{fullAddress}</span>
                          </a>
                        ) : null}
                        {vendor.business_email ? (
                          <a
                            href={`mailto:${vendor.business_email}`}
                            className="group flex items-start gap-2.5 text-foreground transition-colors hover:text-primary"
                          >
                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="leading-snug break-all group-hover:underline">
                              {vendor.business_email}
                            </span>
                          </a>
                        ) : null}
                        {vendor.business_phone ? (
                          <a
                            href={`tel:${vendor.business_phone}`}
                            className="group flex items-start gap-2.5 text-foreground transition-colors hover:text-primary"
                          >
                            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="leading-snug group-hover:underline">{vendor.business_phone}</span>
                          </a>
                        ) : null}
                        {vendor.website_url ? (
                          <a
                            href={vendor.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-2.5 text-foreground transition-colors hover:text-primary"
                          >
                            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="leading-snug group-hover:underline">
                              {vendor.website_url.replace(/^https?:\/\//, '')}
                            </span>
                          </a>
                        ) : null}
                        {!fullAddress && !vendor.website_url && !vendor.business_email && !vendor.business_phone ? (
                          <p className="text-muted-foreground">No public contact info yet.</p>
                        ) : null}
                        <Button className="mt-2 w-full" onClick={() => setLeadOpen(true)}>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Send Message
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">About This Company</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        {vendor.industry_category ? (
                          <div>
                            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Industry</dt>
                            <dd className="mt-1 font-medium">{vendor.industry_category}</dd>
                          </div>
                        ) : null}
                        {memberSince ? (
                          <div>
                            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Member Since
                            </dt>
                            <dd className="mt-1 font-medium">{memberSince}</dd>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </aside>

                  {/* Right column: products */}
                  <section>
                    <Card className="min-h-[480px] border-border/70">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xl">Products & Services</CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/vendor/${vendor.slug}/shop`}>View all</Link>
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {products.length === 0 ? (
                          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                              <Package className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="text-base font-medium">No products or services listed yet.</h3>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                              This vendor hasn't published their offerings. Check back soon!
                            </p>
                          </div>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {products.map((p) => (
                              <Link
                                key={p.id}
                                to={`/vendor/${vendor.slug}/shop/${p.id}`}
                                className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50"
                              >
                                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
                                  {p.image_url ? (
                                    <img
                                      src={p.image_url}
                                      alt={p.name}
                                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                    />
                                  ) : (
                                    <Package className="h-10 w-10 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col gap-1 p-4">
                                  <h3 className="text-sm font-medium leading-snug group-hover:text-primary">
                                    {p.name}
                                  </h3>
                                  {p.description ? (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                                  ) : null}
                                  <p className="mt-auto pt-2 text-sm font-semibold">{formatProductPrice(p)}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </div>
            )}
          </main>

          {vendor ? (
            <VendorLeadModal
              open={leadOpen}
              onOpenChange={setLeadOpen}
              vendorProfileId={vendor.id}
              vendorName={vendor.company_name}
              source="vendor_profile_page"
            />
          ) : null}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
