import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Plus, Shield, Lock, Zap, Search, Filter, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/10 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Lock className="w-3.5 h-3.5" />
            Powered by XRPL Escrow
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Fund the Movement
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Every donation goes directly into on-chain escrow — no middleman, no censorship,
            no platform blocking your cause. Funds release to the recipient on the scheduled date,
            trustlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
                desc: 'Every cause is reviewed and approved by the Accountabul civil division — focused on justice and community defense.',
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
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Causes</h2>
            <p className="text-muted-foreground mt-1">
              All campaigns approved by the Accountabul civil division
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((c) => (
              <CauseCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
