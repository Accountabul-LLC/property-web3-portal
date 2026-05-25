import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

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

export default function CauseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [donateOpen, setDonateOpen] = useState(false)

  const { data: campaign, isLoading, error } = useCampaign(slug!)
  const { data: donations } = useCampaignDonations(campaign?.id ?? '')

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

  const days = daysUntil(campaign.release_date)
  const released = days === 0
  const releaseDate = new Date(campaign.release_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const explorerUrl = `${explorerBase(campaign.network)}/accounts/${campaign.recipient_wallet_address}`
  const pct = campaign.goal_amount
    ? Math.min(100, Math.round((campaign.total_raised / campaign.goal_amount) * 100))
    : null

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
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 h-64 sm:h-80">
              {campaign.image_url ? (
                <img
                  src={campaign.image_url}
                  alt={campaign.title}
                  className="w-full h-full object-cover"
                />
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
                  {donations.map((d: any) => (
                    <div key={d.id} className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {d.donor_wallet_address.slice(1, 3).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {shortAddress(d.donor_wallet_address)}
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
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky donate panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card border border-border rounded-xl p-6 space-y-5">
              {/* Stats */}
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {campaign.total_raised.toLocaleString()}
                  <span className="text-lg font-normal text-muted-foreground ml-1">{campaign.currency}</span>
                </p>
                {campaign.goal_amount && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    of {campaign.goal_amount.toLocaleString()} {campaign.currency} goal
                  </p>
                )}
              </div>

              {/* Progress bar */}
              {pct !== null && (
                <div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pct}% funded</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl font-bold text-foreground">{campaign.donor_count}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> donors
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl font-bold text-foreground">{days}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" /> days left
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 rounded-lg p-2.5">
                <Lock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                {released
                  ? 'Escrow has been released to the recipient.'
                  : `Escrow releases on ${releaseDate}`}
              </div>

              {campaign.status !== 'completed' && !released && (
                user ? (
                  <Button className="w-full" size="lg" onClick={() => setDonateOpen(true)}>
                    <Heart className="w-4 h-4 mr-2" />
                    Donate with Xaman
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => navigate('/auth')}>
                    Sign In to Donate
                  </Button>
                )
              )}

              {(campaign.status === 'completed' || released) && (
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
    </div>
  )
}
