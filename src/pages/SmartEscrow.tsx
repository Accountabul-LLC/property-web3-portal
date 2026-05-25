import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Clock3,
  FileText,
  Lock,
  ShieldCheck,
  Wallet,
  BadgeCheck,
  Layers3,
  ReceiptText,
} from 'lucide-react'

const LIVE_FLOWS = [
  {
    title: 'Causes escrow',
    status: 'Live now',
    icon: ReceiptText,
    description:
      'Approved campaigns create XRPL escrow, lock the donation on-ledger, and release it on the scheduled date.',
    href: '/causes',
  },
  {
    title: 'Escrow-capable MPTs',
    status: 'Configured',
    icon: Layers3,
    description:
      'The mint flow can mark Multi-Purpose Tokens as escrow-capable so holders can place them into escrow later.',
    href: '/mint',
  },
  {
    title: 'Donation history and audit trail',
    status: 'Live now',
    icon: BadgeCheck,
    description:
      'EscrowCreate and EscrowFinish activity is visible in the Causes history and wallet activity feed.',
    href: '/causes/my-donations',
  },
]

const NEXT_STEPS = [
  {
    title: 'Custom asset locks',
    description:
      'Add a dedicated workflow for locking other XRPL asset types with explicit release rules.',
  },
  {
    title: 'Admin release console',
    description:
      'Give operators a traceable dashboard for reviewing escrow state, approvals, and release actions.',
  },
  {
    title: 'Policy-based warnings',
    description:
      'Show stronger consent messaging before a user signs a lock-up that cannot be reversed on demand.',
  },
]

const FLOW_STEPS = [
  {
    step: '01',
    title: 'Choose the escrow path',
    description:
      'Pick the product surface that matches the asset: Causes for donations, Mint for escrow-capable tokens, or future custom escrow flows.',
    icon: Wallet,
  },
  {
    step: '02',
    title: 'Read the warning',
    description:
      'Review the lock duration, release condition, and any refund or cancellation rules before signing.',
    icon: CircleAlert,
  },
  {
    step: '03',
    title: 'Sign on XRPL',
    description:
      'The wallet signs the XRPL transaction. Accountabul never takes custody of the asset.',
    icon: Lock,
  },
  {
    step: '04',
    title: 'Track the state',
    description:
      'Follow the pending, escrowed, and released states from the history and activity surfaces.',
    icon: Clock3,
  },
]

export default function SmartEscrow() {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.96))] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(17,24,39,0.92))]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
              <div className="space-y-6">
                <Badge variant="secondary" className="gap-2 px-3 py-1.5 bg-primary/10 text-primary">
                  <Lock className="w-3.5 h-3.5" />
                  XRPL Escrow Hub
                </Badge>
                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
                    Smart escrow for the assets we already support.
                  </h1>
                  <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                    This is the product surface for escrow-backed workflows on Accountabul:
                    time-locked donation campaigns today, escrow-capable token issuance today,
                    and a clearer path to richer asset locks next.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" disabled={!acknowledged}>
                    <Link to="/causes">
                      Open Causes Escrow
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" disabled={!acknowledged}>
                    <Link to="/mint">
                      Issue Escrow-Capable Token
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
                  <div className="flex gap-3">
                    <CircleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Read this before you continue</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Escrow can lock value until a release rule is satisfied. That is the point
                        of the product, but it also means you should understand the timing,
                        cancellation, and release conditions before you sign anything.
                      </p>
                      <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-3 cursor-pointer">
                        <Checkbox
                          checked={acknowledged}
                          onCheckedChange={(value) => setAcknowledged(value === true)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-muted-foreground leading-relaxed">
                          I understand that escrow can lock funds or tokens until the release
                          conditions are met, and that Accountabul does not custody the asset.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10 blur-3xl rounded-full" />
                <Card className="relative border-border/70 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <CardContent className="p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                          Product posture
                        </p>
                        <h2 className="text-xl font-semibold mt-2">Escrow today, broader locks next</h2>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {LIVE_FLOWS.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.title}
                            to={item.href}
                            className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-foreground">{item.title}</p>
                                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                    {item.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid gap-6 lg:grid-cols-3">
            {FLOW_STEPS.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.step} className="border-border/70 bg-card/80">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold tracking-[0.28em] text-muted-foreground">
                        {item.step}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Layers3 className="w-4 h-4 text-primary" />
                  <h2 className="text-xl font-semibold">What exists now</h2>
                </div>
                <div className="grid gap-4">
                  {LIVE_FLOWS.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-foreground">{item.title}</h3>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="text-xl font-semibold">Next sprint targets</h2>
                </div>
                <div className="space-y-4">
                  {NEXT_STEPS.map((item) => (
                    <div key={item.title} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Ready to wire the escrow path into the product?</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Use Causes for time-locked donations, Mint for escrow-capable assets, and this hub
                as the place where we explain the rules before a user signs anything irreversible.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link to="/causes">
                  Open Causes
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild>
                <Link to="/mint">
                  Open Mint
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
