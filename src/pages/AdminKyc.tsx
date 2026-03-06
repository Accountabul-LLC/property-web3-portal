import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ChevronUp, Check, X } from 'lucide-react'

interface KycCase {
  id: string
  user_id: string
  status: string
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  kyc_form_data: {
    legal_first_name: string | null
    legal_last_name: string | null
    date_of_birth: string | null
    nationality: string | null
    country_of_residence: string | null
    address_line1: string | null
    city: string | null
    postal_code: string | null
    country: string | null
    source_of_funds: string | null
  } | null
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Submitted', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'outline' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

const AdminKyc = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const { data: cases, isLoading } = useQuery({
    queryKey: ['admin-kyc-cases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .select(`
          id, user_id, status, submitted_at, reviewed_at, rejection_reason,
          kyc_form_data (
            legal_first_name, legal_last_name, date_of_birth,
            nationality, country_of_residence, address_line1,
            city, postal_code, country, source_of_funds
          )
        `)
        .in('status', ['submitted', 'under_review'])
        .order('submitted_at', { ascending: true })
      if (error) throw error
      return data as KycCase[]
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const handleDecision = async (kycCaseId: string, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setProcessing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kyc-admin-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kyc_case_id: kycCaseId,
          decision,
          reason: decision === 'rejected' ? rejectionReason : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Case ${decision}`)
      setExpandedId(null)
      setReviewingId(null)
      setRejectionReason('')
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-cases'] })
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">KYC Review Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {cases?.length ?? 0} case{cases?.length !== 1 ? 's' : ''} pending review
          </p>
        </div>

        {(!cases || cases.length === 0) && (
          <Card className="p-8 text-center text-muted-foreground">
            No cases pending review.
          </Card>
        )}

        <div className="space-y-3">
          {cases?.map(kycCase => {
            const form = Array.isArray(kycCase.kyc_form_data)
              ? kycCase.kyc_form_data[0]
              : kycCase.kyc_form_data
            const isExpanded = expandedId === kycCase.id
            const isReviewing = reviewingId === kycCase.id
            const badge = STATUS_BADGE[kycCase.status] ?? { label: kycCase.status, variant: 'outline' as const }

            return (
              <Card key={kycCase.id} className="overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : kycCase.id)}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <div>
                      <p className="font-medium text-sm">
                        {form ? `${form.legal_first_name ?? ''} ${form.legal_last_name ?? ''}`.trim() || 'Unknown' : 'No form data'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {kycCase.submitted_at ? new Date(kycCase.submitted_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {form ? (
                      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                        <div><span className="text-muted-foreground">DOB:</span> {form.date_of_birth ?? '—'}</div>
                        <div><span className="text-muted-foreground">Nationality:</span> {form.nationality ?? '—'}</div>
                        <div><span className="text-muted-foreground">Residence:</span> {form.country_of_residence ?? '—'}</div>
                        <div><span className="text-muted-foreground">Source of Funds:</span> {form.source_of_funds ?? '—'}</div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Address:</span>{' '}
                          {[form.address_line1, form.city, form.postal_code, form.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-4">No form data available.</p>
                    )}

                    {!isReviewing ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => {
                          setReviewingId(kycCase.id)
                          setRejectionReason('')
                        }}>
                          Review
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="reject-reason" className="text-sm">Rejection reason (required if rejecting)</Label>
                          <Input
                            id="reject-reason"
                            placeholder="Enter reason..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleDecision(kycCase.id, 'approved')}
                            disabled={processing}
                          >
                            {processing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDecision(kycCase.id, 'rejected')}
                            disabled={processing}
                          >
                            {processing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                            Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReviewingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default AdminKyc
