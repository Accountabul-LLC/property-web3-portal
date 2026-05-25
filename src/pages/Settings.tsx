import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useKycStatus } from '@/hooks/useKycStatus'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import {
  Bell,
  ChevronRight,
  CreditCard,
  Gauge,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react'

const PAYMENT_RAIL_PREF_KEY = 'accountabul_preferred_payment_rail'

type PreferredRail = 'card' | 'wallet'

function loadPreferredRail(): PreferredRail {
  const saved = localStorage.getItem(PAYMENT_RAIL_PREF_KEY)
  return saved === 'wallet' ? 'wallet' : 'card'
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const { status: kycStatus, isApproved } = useKycStatus()
  const { wallets, activeWallet, activeNetwork, openConnectModal } = useActiveWallet()
  const { hasAccess } = useTeamAccess()
  const [preferredRail, setPreferredRail] = useState<PreferredRail>(() => loadPreferredRail())
  const [notifyEmail, setNotifyEmail] = useState<boolean>(() => localStorage.getItem('accountabul_notify_email') !== 'false')
  const [compactMode, setCompactMode] = useState<boolean>(() => localStorage.getItem('accountabul_compact_mode') === 'true')

  useEffect(() => {
    localStorage.setItem(PAYMENT_RAIL_PREF_KEY, preferredRail)
  }, [preferredRail])

  useEffect(() => {
    localStorage.setItem('accountabul_notify_email', String(notifyEmail))
  }, [notifyEmail])

  useEffect(() => {
    localStorage.setItem('accountabul_compact_mode', String(compactMode))
  }, [compactMode])

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth')
  }, [authLoading, user, navigate])

  const profileName = useMemo(() => {
    return (
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      profile?.full_name ||
      user?.email ||
      'Account settings'
    )
  }, [profile, user?.email])

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1">
        <section className="border-b border-border bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0.96))] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(17,24,39,0.92))]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
              <div className="space-y-5">
                <Badge variant="secondary" className="gap-2 px-3 py-1.5 bg-primary/10 text-primary">
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Account settings
                </Badge>
                <div className="space-y-3">
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                    Your preferences, wallets, and operator tools in one place.
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                    Settings brings the controls we already use across the app into a single place:
                    profile details, wallet preferences, payment defaults, and team-only developer tools.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to="/payments">
                      Open payments
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => openConnectModal()}>
                    <Wallet className="w-4 h-4" />
                    Connect wallet
                  </Button>
                </div>
              </div>

              <Card className="border-border/70 bg-card/90 shadow-card">
                <CardHeader>
                  <CardTitle className="text-xl">Current profile snapshot</CardTitle>
                  <CardDescription>What the app already knows about your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Name</div>
                    <div className="mt-1 font-medium">{profileName}</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</div>
                    <div className="mt-1 font-medium break-all">{user.email ?? 'Not available'}</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">KYC</div>
                    <div className="mt-1 font-medium">{isApproved ? 'Approved' : kycStatus.replace('_', ' ')}</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Wallets</div>
                    <div className="mt-1 font-medium">{wallets.length} linked wallet{wallets.length === 1 ? '' : 's'}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
              <TabsTrigger value="general" className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                General
              </TabsTrigger>
              <TabsTrigger value="wallets" className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Wallets
              </TabsTrigger>
              <TabsTrigger value="payments" className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Payments
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Security
              </TabsTrigger>
              <TabsTrigger value="developer" className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Developer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Gauge className="w-5 h-5 text-primary" />
                      Profile
                    </CardTitle>
                    <CardDescription>Identity and account information already used across the app.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Display name</div>
                      <div className="mt-1 font-medium">{profileName}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Account type</div>
                      <div className="mt-1 font-medium">{profile?.account_type ?? 'individual'}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Member since</div>
                      <div className="mt-1 font-medium">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Recently'}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Bell className="w-5 h-5 text-primary" />
                      Preferences
                    </CardTitle>
                    <CardDescription>Lightweight product preferences we can persist today.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="text-sm font-medium mb-2">Compact interface</div>
                      <Button
                        type="button"
                        variant={compactMode ? 'default' : 'outline'}
                        onClick={() => setCompactMode((v) => !v)}
                      >
                        {compactMode ? 'Compact on' : 'Compact off'}
                      </Button>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="text-sm font-medium mb-2">Email notifications</div>
                      <Button
                        type="button"
                        variant={notifyEmail ? 'default' : 'outline'}
                        onClick={() => setNotifyEmail((v) => !v)}
                      >
                        {notifyEmail ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="wallets">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Wallet className="w-5 h-5 text-primary" />
                      Wallets
                    </CardTitle>
                    <CardDescription>Manage the wallets already linked to your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {wallets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                        No wallets are linked yet. Connect a wallet to unlock wallet rail payments, portfolio tracking,
                        and XRPL actions.
                      </div>
                    ) : (
                      wallets.map((wallet) => (
                        <div key={wallet.address} className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{wallet.label}</div>
                            <div className="text-xs text-muted-foreground font-mono break-all">{wallet.address}</div>
                          </div>
                          <Badge variant={activeWallet?.address === wallet.address ? 'default' : 'outline'}>
                            {activeWallet?.address === wallet.address ? `Active • ${activeNetwork}` : wallet.network}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="text-xl">Wallet rail behavior</CardTitle>
                    <CardDescription>Set the default network and keep wallet sign-in close at hand.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl bg-muted/40 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Default network</div>
                      <div className="mt-1 font-medium">{activeNetwork}</div>
                    </div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => openConnectModal()}>
                      Connect another wallet
                    </Button>
                    <Button asChild variant="ghost" className="w-full">
                      <Link to="/portfolio">Open portfolio</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payments">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Payment defaults
                    </CardTitle>
                    <CardDescription>What the payments page should preselect when you open it.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Preferred rail</div>
                      <Select value={preferredRail} onValueChange={(value) => setPreferredRail(value as PreferredRail)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a rail" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">Credit / debit card</SelectItem>
                          <SelectItem value="wallet">Connected wallet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                      Card payments use Stripe. Wallet payments stay on XRPL and remain XRP-only for v1.
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="text-xl">Payment entry points</CardTitle>
                    <CardDescription>Where to pick up a payment after it is created.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button asChild className="w-full justify-between">
                      <Link to="/payments">
                        Open payments
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-between">
                      <Link to="/payments/history">
                        View payment history
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-between">
                      <Link to="/admin/payments">
                        Open admin ledger
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="security">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      Identity and access
                    </CardTitle>
                    <CardDescription>Use the existing trust and verification layers already in the app.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="rounded-xl bg-muted/40 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">KYC status</div>
                      <div className="mt-1 font-medium">{isApproved ? 'Approved' : kycStatus.replace('_', ' ')}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Password reset</div>
                      <div className="mt-1 font-medium">
                        <Link to="/reset-password" className="underline underline-offset-4">Change your password</Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Lock className="w-5 h-5 text-primary" />
                      What security means here
                    </CardTitle>
                    <CardDescription>These are the rules the product already follows.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Payments settle server-side. Card details go to Stripe, not the browser.</p>
                    <p>Wallet actions sign through the connected XRPL wallet.</p>
                    <p>Verification status controls access to the more sensitive flows.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="developer">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Wrench className="w-5 h-5 text-primary" />
                      Developer tools
                    </CardTitle>
                    <CardDescription>Operator-only utilities and hidden console access.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                      The payments diagnostics stay in code but no longer sit on the public payments page.
                    </div>
                    <Button asChild className="w-full">
                      <Link to="/admin/payments/console">Open payments console</Link>
                    </Button>
                    {hasAccess ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/admin">Open admin dashboard</Link>
                      </Button>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        Developer console access is reserved for team members with admin or compliance access.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="text-xl">Why this tab exists</CardTitle>
                    <CardDescription>We keep operator tooling close to the product without exposing it to normal users.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Use this area for support notes, internal verification, and console entry points.</p>
                    <p>
                      If we later split developer tooling into a separate admin experience, this tab can become a shortcut
                      page instead of a tool surface.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <Footer />
    </div>
  )
}
