import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Copy, Globe, MapPin, MessageCircle, Share2, ShieldCheck, Star, Phone, Mail, Building2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { VendorLeadModal } from '@/components/vendor/VendorLeadModal'
import { getVendorPublicUrl, getVendorTierLabel, type VendorPublicProfileRecord } from '@/lib/vendorNetwork'
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

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    if (!vendor?.slug) return window.location.href
    return `${window.location.origin}${getVendorPublicUrl(vendor.slug)}`
  }, [vendor?.slug])

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

  return (
    <div className="min-h-screen bg-background">
      <Seo title={title} description={description} path={`/vendor/${vendor.slug}`} />
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
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

        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardHeader className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
                  {vendor.logo_url ? (
                    <img src={vendor.logo_url} alt={vendor.company_name} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-3xl">{vendor.company_name}</CardTitle>
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {getVendorTierLabel(vendor.verification_tier)}
                    </Badge>
                  </div>
                  <p className="text-lg text-muted-foreground">{vendor.profile_headline ?? vendor.industry_category ?? 'Verified vendor'}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[vendor.business_address_city, vendor.business_address_state, vendor.business_address_zip].filter(Boolean).join(', ')}
                    </span>
                    {vendor.website_url ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1">
                        <Globe className="h-3.5 w-3.5" />
                        Website available
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="gap-1">
                  <Star className="h-3.5 w-3.5" />
                  Verified
                </Badge>
                <Badge variant="outline">{vendor.industry_category ?? 'General business'}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{vendor.business_description ?? 'No business description provided yet.'}</p>
                  {vendor.service_areas ? <p><span className="font-medium text-foreground">Service areas:</span> {vendor.service_areas}</p> : null}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Business details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Industry</div>
                    <div className="mt-1 font-medium">{vendor.industry_category ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Years in business</div>
                    <div className="mt-1 font-medium">{vendor.years_in_business ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">City / State</div>
                    <div className="mt-1 font-medium">{[vendor.business_address_city, vendor.business_address_state].filter(Boolean).join(', ') || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Verification tier</div>
                    <div className="mt-1 font-medium">{getVendorTierLabel(vendor.verification_tier)}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {vendor.website_url ? (
                    <div className="flex items-start gap-2">
                      <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Website</div>
                        <a href={vendor.website_url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          Visit website
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {vendor.business_email ? (
                    <div className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium">{vendor.business_email}</div>
                      </div>
                    </div>
                  ) : null}
                  {vendor.business_phone ? (
                    <div className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div className="font-medium">{vendor.business_phone}</div>
                      </div>
                    </div>
                  ) : null}
                  {!vendor.website_url && !vendor.business_email && !vendor.business_phone ? (
                    <p className="text-muted-foreground">This vendor has not shared public contact info yet.</p>
                  ) : null}
                  <Button className="w-full" onClick={() => setLeadOpen(true)}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact vendor
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Public URL</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs break-all">{shareUrl}</div>
                  <Button variant="outline" className="w-full" onClick={handleShare}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy or share link
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
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
