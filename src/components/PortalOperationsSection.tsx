import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardCheck, FileSpreadsheet, ShieldCheck } from 'lucide-react'

const PortalOperationsSection = () => {
  const entries = [
    {
      title: 'Legal Packet',
      description:
        'Privacy, terms, compliance, security, data declarations, and IP checks for Accountabul app and website launches.',
      href: '/legal/privacy',
      buttonLabel: 'Open legal packet',
      icon: ShieldCheck,
    },
    {
      title: 'DOE Operations',
      description:
        'Daily operating expense worksheet for tracking property spend by date, category, vendor, payment method, and amount.',
      href: '/operations/doe',
      buttonLabel: 'Open DOE sheet',
      icon: FileSpreadsheet,
    },
  ]

  return (
    <section className="border-y border-border bg-background py-16 px-4">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-primary">
              <ClipboardCheck className="h-4 w-4" />
              Main Portal Documents
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Operating files attached to the portal</h2>
            <p className="mt-3 text-muted-foreground">
              These are the two global working documents every property workflow should be able to reach quickly:
              legal readiness and daily operating expenses.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {entries.map((entry) => {
            const Icon = entry.icon
            return (
              <Card key={entry.title} className="border-border/70">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{entry.title}</CardTitle>
                  <CardDescription>{entry.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to={entry.href}>{entry.buttonLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default PortalOperationsSection
