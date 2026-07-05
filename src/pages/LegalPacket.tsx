import { Link, useParams } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from 'lucide-react'

type LegalSection = 'privacy' | 'terms' | 'compliance' | 'security'

const sectionMeta: Record<
  LegalSection,
  {
    title: string
    label: string
    description: string
    icon: typeof FileText
    updated: string
  }
> = {
  privacy: {
    title: 'Privacy Policy',
    label: 'Privacy',
    description: 'The global privacy baseline for Accountabul properties, apps, and connected services.',
    icon: ShieldCheck,
    updated: 'July 5, 2026',
  },
  terms: {
    title: 'Terms of Service',
    label: 'Terms',
    description: 'Rules for accounts, payments, marketplace participation, and acceptable use.',
    icon: Scale,
    updated: 'July 5, 2026',
  },
  compliance: {
    title: 'Compliance Packet',
    label: 'Compliance',
    description: 'Data declarations, regional privacy notices, app-store readiness, and IP clearance checks.',
    icon: ClipboardCheck,
    updated: 'July 5, 2026',
  },
  security: {
    title: 'Security Notice',
    label: 'Security',
    description: 'How Accountabul handles identity, wallet, payment, and operational security expectations.',
    icon: LockKeyhole,
    updated: 'July 5, 2026',
  },
}

const dataInventory = [
  ['Account identity', 'Name, email, profile role', 'Account creation, login, support, permissions', 'Account lifetime plus legal retention'],
  ['Wallet data', 'Public wallet address, network, signed actions', 'Portfolio, XRPL payments, ownership verification', 'Account lifetime or until wallet removal'],
  ['Transaction records', 'Payment status, invoices, checkout references', 'Receipts, reconciliation, fraud review, tax support', 'Required business record period'],
  ['Compliance data', 'KYC status, verification metadata', 'Access control, fraud prevention, regulatory compliance', 'As required by compliance provider and law'],
  ['Operational data', 'Crash logs, device/browser info, analytics events', 'Security, diagnostics, product reliability', 'Limited operational retention'],
]

const complianceChecklist = [
  'Publish Privacy Policy and Terms links in every site footer before launch.',
  'Declare every collected data category in App Store, Play Store, and internal release records.',
  'Maintain a notice at collection where California personal information is collected.',
  'Document GDPR/UK GDPR purposes, retention windows, and user rights request workflow.',
  'Run USPTO, domain, social handle, font, logo, and stock asset checks before naming a new app.',
  'Review children, health, finance, precise location, biometric, and other sensitive data before release.',
]

const securityControls = [
  'Card payment data is handled by Stripe surfaces instead of being stored directly in the app.',
  'Wallet actions are signed by the connected wallet and recorded as public blockchain activity when submitted.',
  'KYC-gated flows require verification before sensitive product actions are enabled.',
  'Admin and compliance routes use role checks before exposing internal tools.',
  'Operational logs should avoid secrets, private keys, seed phrases, and unnecessary personal data.',
]

function normalizeSection(section?: string): LegalSection {
  if (section === 'terms' || section === 'compliance' || section === 'security') return section
  return 'privacy'
}

function PrivacyContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>What This Covers</CardTitle>
          <CardDescription>Use this as the shared privacy baseline for Accountabul sites and app surfaces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Accountabul may collect account identity, contact information, wallet addresses, payment references,
            compliance status, marketplace activity, device/browser information, analytics, and support messages.
          </p>
          <p>
            Data is used to operate the portal, secure accounts, complete payments, satisfy compliance obligations,
            support users, improve reliability, and prevent fraud or misuse.
          </p>
          <p>
            Third-party providers may include payment processors, identity verification providers, hosting vendors,
            analytics tools, email providers, and blockchain networks used to complete wallet-based actions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Rights</CardTitle>
          <CardDescription>Regional rules may require specific access, deletion, correction, and opt-out workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Users may request access to personal data, correction of inaccurate data, deletion where permitted, or more detail about data handling.</p>
          <p>California users may have rights to know, delete, correct, and limit certain uses of sensitive personal information.</p>
          <p>European and UK users may have rights to access, portability, restriction, objection, erasure, and complaint to a supervisory authority.</p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            This packet is an operational template and should be reviewed by counsel before public release.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function TermsContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[
        ['Account Rules', 'Users must provide accurate information, protect their credentials and wallets, and follow role-based access rules.'],
        ['Marketplace Conduct', 'Users may not submit fraudulent listings, infringe intellectual property, manipulate prices, harass participants, or bypass verification.'],
        ['Liability Limits', 'The service is provided as a technology platform. Property, investment, tax, legal, and compliance decisions remain the user responsibility.'],
      ].map(([title, body]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
        </Card>
      ))}
    </div>
  )
}

function ComplianceContent() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Declaration Matrix
          </CardTitle>
          <CardDescription>Use this as the starting point for App Store privacy details and release reviews.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Examples</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Retention</th>
                </tr>
              </thead>
              <tbody>
                {dataInventory.map(([category, examples, purpose, retention]) => (
                  <tr key={category} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{category}</td>
                    <td className="px-3 py-3 text-muted-foreground">{examples}</td>
                    <td className="px-3 py-3 text-muted-foreground">{purpose}</td>
                    <td className="px-3 py-3 text-muted-foreground">{retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Release Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceChecklist.map((item) => (
              <div key={item} className="flex gap-3 text-sm">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IP Clearance</CardTitle>
            <CardDescription>Run before app naming, launch pages, and branded assets go live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Search the proposed app name across Google, domains, social handles, marketplace listings, and USPTO records.</p>
            <p>Confirm logo, font, icon, media, stock asset, and generated asset rights before distribution.</p>
            <Button asChild variant="outline" className="mt-2">
              <a href="https://tmsearch.uspto.gov/" target="_blank" rel="noopener noreferrer">
                Open USPTO Search
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SecurityContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <CardHeader>
          <CardTitle>Security Controls</CardTitle>
          <CardDescription>Baseline controls to keep attached to every website or app release.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityControls.map((item) => (
            <div key={item} className="flex gap-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Launch Gate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>No private keys, seed phrases, webhook secrets, service keys, or unredacted identity documents should be shipped to the browser or committed to public repositories.</p>
          <p>Before each launch, verify environment variables, role checks, payment webhooks, and public legal links in production.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LegalPacket() {
  const { section: rawSection } = useParams()
  const section = normalizeSection(rawSection)
  const meta = sectionMeta[section]
  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <Badge variant="secondary" className="gap-2 px-3 py-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  Global Legal Packet
                </Badge>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-foreground">{meta.title}</h1>
                  <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{meta.description}</p>
                </div>
                <p className="text-sm text-muted-foreground">Last reviewed: {meta.updated}</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/operations/doe">Open DOE sheet</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(sectionMeta) as LegalSection[]).map((key) => (
              <Button key={key} asChild variant={key === section ? 'default' : 'outline'} size="sm">
                <Link to={`/legal/${key}`}>{sectionMeta[key].label}</Link>
              </Button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          {section === 'privacy' && <PrivacyContent />}
          {section === 'terms' && <TermsContent />}
          {section === 'compliance' && <ComplianceContent />}
          {section === 'security' && <SecurityContent />}
        </section>
      </main>
      <Footer />
    </div>
  )
}
