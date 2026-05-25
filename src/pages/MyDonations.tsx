import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Calendar, Lock, ExternalLink, Loader2, Wallet } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useMyDonations } from '@/hooks/useCampaigns'

function explorerBase(network?: string | null) {
  return network === 'testnet'
    ? 'https://testnet.xrpl.org'
    : 'https://livenet.xrpl.org'
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusClass(status: string) {
  if (status === 'released') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'escrowed') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (status === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-muted text-muted-foreground'
}

export default function MyDonations() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { data: donations, isLoading } = useMyDonations(user?.id)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex items-center">
          <Card className="w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Sign in to see your donations</h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Your donation history is tied to your signed-in account so you can track escrow status, release timing, and campaign history.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/auth')}>Sign In</Button>
              <Button variant="outline" onClick={() => navigate('/causes')}>
                Back to Causes
              </Button>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  const totalDonated = (donations ?? []).reduce((sum, donation) => sum + Number(donation.amount || 0), 0)
  const releasedCount = (donations ?? []).filter((d) => d.escrow_status === 'released').length
  const escrowedCount = (donations ?? []).filter((d) => d.escrow_status === 'escrowed').length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <button
          onClick={() => navigate('/causes')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Causes
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Heart className="w-3.5 h-3.5" />
              Donation history
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">My Donations</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Track what you have supported, how much you have given, and whether each donation is still in escrow or has been released.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Donated</p>
              <p className="text-lg font-bold mt-1">{totalDonated.toLocaleString()} XRP</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">In Escrow</p>
              <p className="text-lg font-bold mt-1">{escrowedCount}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Released</p>
              <p className="text-lg font-bold mt-1">{releasedCount}</p>
            </Card>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!donations || donations.length === 0) && (
          <Card className="p-10 text-center">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No donations yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Once you donate to a cause, it will show up here with its escrow status.
            </p>
            <Button onClick={() => navigate('/causes')}>
              Explore Causes
            </Button>
          </Card>
        )}

        {!isLoading && donations && donations.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {donations.map((donation) => {
              const campaign = donation.campaigns
              const explorerUrl = campaign
                ? `${explorerBase(campaign.network)}/accounts/${campaign.recipient_wallet_address}`
                : null

              return (
                <Card key={donation.id} className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        {campaign?.campaign_type === 'direct'
                          ? 'Direct donation'
                          : campaign?.release_date
                            ? `Release ${formatDate(campaign.release_date)}`
                            : 'Donation'}
                      </p>
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                        {campaign?.title ?? 'Campaign no longer available'}
                      </h3>
                    </div>
                    <Badge className={statusClass(donation.escrow_status)}>
                      {donation.escrow_status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="text-2xl font-bold text-foreground">
                        {Number(donation.amount).toLocaleString()} {donation.currency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Donated</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(donation.created_at)}</p>
                    </div>
                  </div>

                  {donation.donor_message && (
                    <div className="mb-4 rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your message</p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {donation.donor_message}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      {campaign?.campaign_type === 'direct' ? 'XRPL direct donation' : 'XRPL escrow donation'}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {campaign && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/causes/${campaign.slug}`)}>
                          View Cause
                        </Button>
                      )}
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          Open Explorer
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
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
