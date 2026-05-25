import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, ShieldCheck, Brain, Users, FileSearch, KeyRound, Heart, ReceiptText } from 'lucide-react'

const ADMIN_LINKS = [
  {
    title: 'Causes',
    description: 'Review campaign submissions, approve or reject causes, and trigger escrow release when funds are ready.',
    href: '/admin/causes',
    icon: Heart,
  },
  {
    title: 'KYC Review',
    description: 'Review and approve user identity verification applications.',
    href: '/admin/kyc',
    icon: FileSearch,
  },
  {
    title: 'Credential Management',
    description: 'Manage the testnet XRPL credential issuer, approve wallet registrations, and issue or revoke trading credentials.',
    href: '/admin/credentials',
    icon: KeyRound,
  },
  {
    title: 'Payments',
    description: 'Observe payments, invoices, provider status, and reconciliation for the payments product.',
    href: '/admin/payments',
    icon: ReceiptText,
  },
  {
    title: 'AI Panel',
    description: 'Access the multi-model AI debate panel for research and analysis.',
    href: '/admin/ai-panel',
    icon: Brain,
  },
  {
    title: 'User Management',
    description: 'View registered users, assign roles, and manage permissions.',
    href: '/admin/users',
    icon: Users,
  },
]

const Admin = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useTeamAccess()

  useEffect(() => {
    if (authLoading || accessLoading) return
    if (!user) {
      navigate('/auth')
      return
    }
    if (!hasAccess) {
      navigate('/dashboard')
    }
  }, [user, authLoading, hasAccess, accessLoading, navigate])

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasAccess) return null

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage platform operations and compliance</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_LINKS.map((item) => (
            <Link key={item.href} to={item.href} className="group">
              <Card className="p-6 h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Admin
