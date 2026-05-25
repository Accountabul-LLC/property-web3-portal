import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Heart, Users, Calendar, Lock, ArrowLeft, ExternalLink, CheckCircle2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import DonateModal from '@/components/causes/DonateModal'
import { WalletConnectModal } from '@/components/WalletConnectModal'
import { useCampaign, useCampaignDonations } from '@/hooks/useCampaigns'
import { useAuth } from '@/hooks/useAuth'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useXrpPrice, formatUsd } from '@/hooks/useXrpPrice'
import { supabase } from '@/integrations/supabase/client'

import {
  formatCauseReleaseCountdown,
  formatCauseReleaseUnlockTimestamp,
  isCauseReleaseReady,
} from '@/lib/causesRelease'

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function explorerBase(network?: string | null) {
  return network === 'testnet'
    ? 'https://testnet.xrpl.org'
    : 'https://livenet.xrpl.org'
}

function videoSrc(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`
    }
  } catch {
    return url
  }
  return url
}

function isVideoFile(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url)
}

function CauseHero({ campaign }: { campaign: any }) {
  const gallery: string[] = Array.isArray(campaign.gallery_urls) ? campaign.gallery_urls : []
  const all = [campaign.image_url, ...gallery].filter(Boolean) as string[]
  const [active, setActive] = useState<string | null>(all[0] ?? null)
  const current = active ?? all[0] ?? null
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 h-64 sm:h-80">
        {current ? (
          <img src={current} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Heart className="w-24 h-24 text-primary/20" />
          </div>
        )}
        {campaign.status === 'completed' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p className="font-bold text-xl">Fully Funded</p>
            </div>
          </div>
        )}
      </div>
      {all.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {all.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => setActive(url)}
              className={`relative h-16 w-24 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                current === url ? 'border-primary' : 'border-transparent hover:border-border'
              }`}
            >
              <img src={url} alt={`${campaign.title} ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CauseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isConnected } = useActiveWallet()
  const [donateOpen, setDonateOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const { data: campaign, isLoading, error } = useCampaign(slug!)
  const { data: donations } = useCampaignDonations(campaign?.id ?? '')
  const { data: xrpPrice } = useXrpPrice()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const queryClient = useQueryClient()
  const campaignId = campaign?.id
  useEffect(() => {
    if (!campaignId) return
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaign', slug] })
          queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_donations', filter: `campaign_id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaign-donations', campaignId] })
          queryClient.invalidateQueries({ queryKey: ['campaign', slug] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, slug, queryClient])


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Campaign not found.</p>
          <Button variant="outline" onClick={() => navigate('/causes')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Causes
          </Button>
        </div>
      </div>
    )
  }

  const unlockCountdown = formatCauseReleaseCountdown(campaign.release_date, now)
  const unlockTimestamp = formatCauseReleaseUnlockTimestamp(campaign.release_date)
  const releaseReady = isCauseReleaseReady(campaign.release_date, now)
  const releaseDate = new Date(campaign.release_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const explorerUrl = `${explorerBase(campaign.network)}/accounts/${campaign.recipient_wallet_address}`
  const pct = campaign.goal_amount
    ? Math.min(100, Math.round((campaign.total_raised / campaign.goal_amount) * 100))
    : null
  const isXrp = (campaign.currency || 'XRP').toUpperCase() === 'XRP'

  const raisedUsd = isXrp && xrpPrice ? campaign.total_raised * xrpPrice : null
  const goalUsd = isXrp && xrpPrice && campaign.goal_amount ? campaign.goal_amount * xrpPrice : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Back */}
        <button
          onClick={() => navigate('/causes')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Causes
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero image */}
            <CauseHero campaign={campaign} />


            {/* Title + badges */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  XRPL Escrow
                </Badge>
                {campaign.status === 'completed' && (
                  <Badge className="bg-green-600 text-white">Funded</Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                {campaign.title}
              </h1>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {campaign.description}
              </p>
            </div>

            {/* Recipient wallet */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Recipient Wallet (verified on {campaign.network === 'testnet' ? 'Testnet' : 'Mainnet'})
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground break-all">
                  {campaign.recipient_wallet_address}
                </code>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:opacity-70 transition-opacity flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* How escrow works */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                How your donation is protected
              </p>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
                <li>You sign an EscrowCreate transaction in Xaman — funds leave your wallet immediately</li>
                <li>Funds are locked on the XRP Ledger, not in a bank account or platform wallet</li>
                <li>On <strong>{releaseDate}</strong>, EscrowFinish is called — funds go directly to the recipient</li>
                <li>No human can touch the funds between those two events</li>
              </ol>
            </div>

            {campaign.video_url && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <p className="font-semibold text-foreground">Campaign Video</p>
                  <p className="text-xs text-muted-foreground mt-1">Optional campaign media provided by the applicant.</p>
                </div>
                <div className="aspect-video bg-black">
                  {isVideoFile(campaign.video_url) ? (
                    <video
                      className="w-full h-full object-cover"
                      controls
                      src={campaign.video_url}
                    />
                  ) : (
                    <iframe
                      src={videoSrc(campaign.video_url)}
                      title={`${campaign.title} video`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
            )}

            {/* Donation feed */}
            {donations && donations.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-4">Recent Supporters</h3>
                <div className="space-y-3">
                  {donations.map((d: any) => {
                    const anon = !!d.is_anonymous
                    const displayName = anon
                      ? 'Anonymous'
                      : (d.donor_display_name?.trim() || shortAddress(d.donor_wallet_address))
                    const initials = anon
                      ? 'A'
                      : (d.donor_display_name?.trim()
                          ? d.donor_display_name.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
                          : (d.donor_wallet_address?.slice(1, 3).toUpperCase() ?? '??'))
                    return (
                    <div key={d.id} className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className={`text-xs ${anon ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${anon ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                            {displayName}
                          </span>
                          <span className="text-sm font-semibold text-primary">
                            {d.amount} {d.currency}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${d.escrow_status === 'released' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}
                          >
                            {d.escrow_status === 'released' ? 'Released' : 'In Escrow'}
                          </Badge>
                        </div>
                        {d.donor_message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            "{d.donor_message}"
                          </p>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky donate panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card border border-border rounded-xl p-6 space-y-5">
              {isXrp && xrpPrice ? (
                <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-full bg-muted/60 border border-border">
                  <span className="text-muted-foreground">XRP price</span>
                  <span className="font-medium text-foreground inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {formatUsd(xrpPrice)}
                  </span>
                </div>
              ) : null}

              {/* Raised vs Goal */}
              <div>
                <div className="flex justify-between items-baseline mb-3 gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-3xl font-bold text-foreground tracking-tight truncate">
                      {campaign.total_raised.toLocaleString()} {campaign.currency}
                    </span>
                    {raisedUsd !== null && (
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider mt-0.5">
                        {formatUsd(raisedUsd)} in escrow
                      </span>
                    )}
                  </div>
                  {campaign.goal_amount && (
                    <div className="text-right shrink-0">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Goal</span>
                      <div className="text-lg font-semibold text-foreground">
                        {campaign.goal_amount.toLocaleString()} {campaign.currency}
                      </div>
                    </div>
                  )}
                </div>

                {pct !== null && (
                  <>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-sm font-semibold text-foreground">{pct}% raised</span>
                      {campaign.goal_amount && (
                        <span className="text-sm text-muted-foreground">
                          {Math.max(0, campaign.goal_amount - campaign.total_raised).toLocaleString()} {campaign.currency} to go
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>



              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl font-bold text-foreground">{campaign.donor_count}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> donors
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl font-bold text-foreground" title={unlockTimestamp}>
                    {releaseReady ? 'Ready' : unlockCountdown.replace('Unlocks in ', '')}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" /> unlock window
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 rounded-lg p-2.5">
                <Lock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                {campaign.status === 'completed' || releaseReady
                  ? 'Ready to release to the recipient.'
                  : `${unlockCountdown}. Exact unlock time: ${unlockTimestamp}`}
              </div>

              {campaign.status !== 'completed' && !releaseReady && (
                !user ? (
                  <Button className="w-full" size="lg" onClick={() => navigate('/auth')}>
                    Sign In to Donate
                  </Button>
                ) : !isConnected ? (
                  <Button className="w-full" size="lg" onClick={() => setWalletModalOpen(true)}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet to Donate
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => setDonateOpen(true)}>
                    <Heart className="w-4 h-4 mr-2" />
                    Donate
                  </Button>
                )
              )}

              {(campaign.status === 'completed' || releaseReady) && (
                <Button variant="outline" className="w-full" disabled>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                  Funds Released
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {campaign && (
        <DonateModal
          campaign={campaign}
          open={donateOpen}
          onClose={() => setDonateOpen(false)}
        />
      )}

      <WalletConnectModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onWalletConnected={() => {
          setWalletModalOpen(false)
          setDonateOpen(true)
        }}
      />
    </div>
  )
}
