import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Plus, Shield, Lock, Zap, Search, Filter, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import CauseCard from '@/components/causes/CauseCard'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useAuth } from '@/hooks/useAuth'

export default function Causes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: campaigns, isLoading } = useCampaigns()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (campaigns ?? []).filter((campaign) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && campaign.status === 'active') ||
        (filter === 'completed' && campaign.status === 'completed')

      const matchesSearch =
        !q ||
        campaign.title.toLowerCase().includes(q) ||
        campaign.description.toLowerCase().includes(q) ||
        campaign.recipient_wallet_address.toLowerCase().includes(q)

      return matchesFilter && matchesSearch
    })
  }, [campaigns, search, filter])

  const featuredCampaigns = useMemo(() => filteredCampaigns.slice(0, 2), [filteredCampaigns])
  const remainingCampaigns = useMemo(() => filteredCampaigns.slice(2), [filteredCampaigns])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_left,rgba(59,130,246,0.14),transparent_25%),linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.95))] dark:bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.22),transparent_30%),radial-gradient(circle_at_left,rgba(59,130,246,0.18),transparent_25%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(17,24,39,0.92))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
                <Lock className="w-3.5 h-3.5" />
                Powered by XRPL Escrow
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 leading-tight">
                Don't just read causes.
                <span className="block text-primary">See the donation cards first.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-8">
                Approved campaigns are curated by the Accountabul team, funded through XRPL escrow,
                and presented with clear progress so donors can act fast and understand exactly what they’re backing.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button size="lg" onClick={() => navigate('/causes/apply')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit a Cause
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/causes/my-donations')}>
                  My Donations
                </Button>
                {!user && (
                  <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
                    Sign In to Donate
                  </Button>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 via-transparent to-pink-500/10 blur-2xl rounded-full" />
              <div className="relative rounded-3xl border border-border/70 bg-card/85 backdrop-blur-xl shadow-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Featured causes</p>
                    <p className="text-sm text-muted-foreground mt-1">Top campaigns in the center of attention</p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    Live
                  </Badge>
                </div>
                {featuredCampaigns.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {featuredCampaigns.map((campaign) => (
                      <div key={campaign.id} className="rounded-2xl overflow-hidden border border-border/70 bg-background/80 shadow-sm">
                        <CauseCard campaign={campaign} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center">
                    <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">No featured causes yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Approved campaigns will appear here once available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: 'Trustless Escrow',
                desc: 'Donations lock on the XRP Ledger the moment you send. The Accountabul team never holds or controls your funds.',
              },
              {
                icon: Shield,
                title: 'Curated Campaigns',
                desc: 'Every cause is reviewed and approved by the Accountabul civil division - focused on justice and community defense.',
              },
              {
                icon: Zap,
                title: 'Censorship Resistant',
                desc: 'No bank, no payment processor, no platform can freeze or block donations. Once in escrow, it will reach its destination.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Campaign grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Browse campaigns</h2>
              <p className="text-muted-foreground mt-1 max-w-2xl">
                Search the public catalog, filter by status, and open a campaign to donate.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => navigate('/causes/my-donations')}>
                My Donations
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/causes/apply')}>
                <Plus className="w-4 h-4 mr-2" />
                Submit Cause
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-border bg-card/80 p-4 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Donation cards are the product.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    These cards show impact, progress, and timing before the user has to click into details.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card/80 p-4 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ChevronRight className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Submission is secondary.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep the admin/apply path accessible, but don't let it compete with the live campaigns.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search causes by title, description, or wallet"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
              {(['all', 'active', 'completed'] as const).map((item) => (
                <Button
                  key={item}
                  variant={filter === item ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(item)}
                  className="capitalize"
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-96 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filteredCampaigns.length === 0 && (
          <div className="text-center py-20">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-medium">
              {search || filter !== 'all' ? 'No causes match your search' : 'No active campaigns yet'}
            </p>
            <p className="text-muted-foreground/70 text-sm mt-1 mb-6">
              {search || filter !== 'all'
                ? 'Try a different search term or clear the filter.'
                : 'Be the first to submit a cause for review'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/causes/apply')}>
                <Plus className="w-4 h-4 mr-2" />
                Submit a Cause
              </Button>
              <Button variant="outline" onClick={() => navigate('/causes/my-donations')}>
                My Donations
              </Button>
            </div>
          </div>
        )}

        {!isLoading && filteredCampaigns.length > 0 && (
          <div className="space-y-8">
            {featuredCampaigns.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Featured campaigns</h3>
                  <p className="text-sm text-muted-foreground">Top cards highlighted above the fold</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {featuredCampaigns.map((c) => (
                    <CauseCard key={c.id} campaign={c} />
                  ))}
                </div>
              </div>
            )}

            {remainingCampaigns.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">More campaigns</h3>
                  <p className="text-sm text-muted-foreground">
                    {remainingCampaigns.length} more result{remainingCampaigns.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {remainingCampaigns.map((c) => (
                    <CauseCard key={c.id} campaign={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
