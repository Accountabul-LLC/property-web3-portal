import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type VendorBenefitsCardProps = {
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  eyebrow?: string
  title?: string
  description?: string
  reviewCopy?: string
}

const benefits = [
  'Business profile in the marketplace',
  'Verified vendor badge after manual approval',
  'Marketplace placement and promotional exposure',
  'Access to customer leads and booking opportunities',
  'Business-only tools, analytics, and vendor controls',
  'KYB-based trust credential for higher confidence routing',
]

export function VendorBenefitsCard({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel = 'View status',
  eyebrow = 'Verified vendor program',
  title = 'What verified vendors receive',
  description = 'This is a paid, manually reviewed application. You submit your business details, we review the file, and you hear back within 24 to 48 hours.',
  reviewCopy = 'No instant badge. No automatic approval.',
}: VendorBenefitsCardProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            <BriefcaseBusiness className="mr-2 h-3.5 w-3.5" />
            {eyebrow}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            <CalendarClock className="mr-2 h-3.5 w-3.5" />
            24-48 hour review
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl md:text-3xl">{title}</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-relaxed">
            {description}
          </CardDescription>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-100">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            {reviewCopy}
          </div>
          <p className="mt-1 text-sm opacity-90">
            We use the review step to confirm the business, payment, and compliance details before a verified vendor
            credential is issued.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="min-w-48">
            <Link to={primaryHref}>
              {primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {secondaryHref ? (
            <Button asChild variant="outline" size="lg" className="min-w-48">
              <Link to={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Vendors can be routed to the right page based on application state: apply, pending review, verified, or
          reapply if the review outcome requires it.
        </p>
      </CardContent>
    </Card>
  )
}
