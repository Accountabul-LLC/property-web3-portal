import React from 'react'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { LockedProductGate } from '@/components/LockedProductGate'
import { Loader2 } from 'lucide-react'

/**
 * Renders the real page for admins; otherwise shows the LockedProductGate.
 * Admin role is enforced server-side via RLS on user_roles + has_role().
 */
export function AdminOrLocked({ children }: { children: React.ReactNode }) {
  const { hasAccess: isAdmin, loading } = useTeamAccess()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) return <LockedProductGate />
  return <>{children}</>
}
