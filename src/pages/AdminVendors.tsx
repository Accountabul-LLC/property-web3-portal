import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { Loader2, ShieldCheck } from 'lucide-react'
import VendorCRMPanel from '@/components/admin/VendorCRMPanel'

export default function AdminVendors() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useTeamAccess()

  useEffect(() => {
    if (authLoading || accessLoading) return
    if (!user) {
      navigate('/auth')
      return
    }
    if (!hasAccess) navigate('/dashboard')
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Verified Vendors</h1>
            <p className="text-sm text-muted-foreground">Review vendor requests and manage the business CRM network.</p>
          </div>
        </div>

        <VendorCRMPanel />
      </div>
      <Footer />
    </div>
  )
}
