import { Link } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Seo } from '@/components/Seo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Clock3, Heart, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'

const escrowFlows = [
  {
    title: 'Cause Donations',
    description: 'Support approved campaigns through the regular donation escrow flow.',
    href: '/causes',
    cta: 'Open Causes',
    icon: Heart,
  },
  {
    title: 'Donation History',
    description: 'Review your pending, escrowed, and released donations in one place.',
    href: '/causes/my-donations',
    cta: 'View Donations',
    icon: ReceiptText,
  },
  {
    title: 'Payments',
    description: 'Use the standard payment rail for regular account-to-account activity.',
    href: '/payments',
    cta: 'Open Payments',
    icon: Wallet,
  },
]

export default function Escrow() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Escrow Hub | Accountabul"
        description="Use Accountabul's regular escrow and payment flows for donations, donation history, and standard payments."
        path="/escrow"
      />
      <Navigation />

      <main className="flex-1">
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18">
            <div className="max-w-3xl space-y-5">
              <Badge variant="secondary" className="gap-2 px-3 py-1.5 bg-primary/10 text-primary">
                <ShieldCheck className="w-3.5 h-3.5" />
                Regular Escrow Hub
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Use the regular escrow flows.
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Smart escrow is locked for internal use. Public users can continue with the standard donation escrow, donation history, and payment tools below.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid gap-5 md:grid-cols-3">
            {escrowFlows.map((flow) => {
              const Icon = flow.icon
              return (
                <Card key={flow.title} className="border-border/70 bg-card">
                  <CardContent className="p-6 flex flex-col min-h-[260px]">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <h2 className="text-xl font-semibold text-foreground">{flow.title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{flow.description}</p>
                    </div>
                    <Button asChild className="mt-6 w-full justify-between">
                      <Link to={flow.href}>
                        {flow.cta}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Clock3 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Smart escrow is restricted</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Advanced smart escrow workflows are not available publicly right now. This hub only exposes the regular escrow and payment surfaces.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}