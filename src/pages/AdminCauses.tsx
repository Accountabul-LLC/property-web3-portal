import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Loader2, ChevronDown, ChevronUp, Check, X, Heart,
  ExternalLink, Lock, Users, Calendar, Send, ArrowLeft, Plus, Sparkles, Wallet, Upload,
} from 'lucide-react'

type CampaignStatus = 'under_review' | 'approved' | 'active' | 'completed' | 'rejected'
type CampaignNetwork = 'mainnet' | 'testnet'

interface Campaign {
  id: string
  title: string
  slug: string
  description: string
  image_url: string | null
  video_url: string | null
  network: 'mainnet' | 'testnet'
  goal_amount: number | null
  currency: string
  recipient_wallet_address: string
  release_date: string
  status: CampaignStatus
  submitted_by_email: string | null
  submission_notes: string | null
  total_raised: number
  donor_count: number
  created_at: string
}

const STATUS_BADGE: Record<CampaignStatus, { label: string; className: string }> = {
  under_review: { label: 'Under Review', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  approved:     { label: 'Approved',     className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  active:       { label: 'Active',       className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  completed:    { label: 'Completed',    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  rejected:     { label: 'Rejected',     className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

function explorerBase(network?: string | null) {
  return network === 'testnet'
    ? 'https://testnet.xrpl.org'
    : 'https://livenet.xrpl.org'
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export default function AdminCauses() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useTeamAccess()
  const qc = useQueryClient()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'under_review' | 'active' | 'all'>('under_review')
  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    image_url: '',
    video_url: '',
    goal_amount: '',
    recipient_wallet_address: '',
    release_date: '',
    network: 'testnet' as CampaignNetwork,
    status: 'under_review' as CampaignStatus,
    submitted_by_email: user?.email ?? '',
    submission_notes: '',
    admin_notes: '',
  })

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false }) as any
      if (error) throw error
      return data as Campaign[]
    },
    enabled: !!user && hasAccess,
  })

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !hasAccess) {
    navigate('/dashboard')
    return null
  }

  async function handleApprove(id: string) {
    setProcessing(id)
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          status: 'active',
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id) as any
      if (error) throw error
      toast.success('Campaign approved and now live')
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(id: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a rejection reason')
      return
    }
    setProcessing(id)
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', id) as any
      if (error) throw error
      toast.success('Campaign rejected')
      setRejectionReason('')
      setExpandedId(null)
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(null)
    }
  }

  async function handleRelease(campaign: Campaign) {
    setProcessing(campaign.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-release`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ campaign_id: campaign.id }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Release failed')
      if (json.campaign_completed) {
        toast.success(`All escrow released for ${campaign.title}`)
      } else if ((json.manual_count ?? 0) > 0 && (json.released_count ?? 0) === 0) {
        toast.info(`Release prepared for manual signing — ${json.manual_count} escrow(s) waiting`)
      } else if ((json.manual_count ?? 0) > 0) {
        toast.info(`${json.released_count} escrow(s) released, ${json.manual_count} still need manual signing`)
      } else {
        toast.success(`Released ${json.released_count} escrow(s)`)
      }
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(null)
    }
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `causes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('campaign-images')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('campaign-images').getPublicUrl(path)
      setCreateForm((prev) => ({ ...prev, image_url: data.publicUrl }))
      toast.success('Image uploaded')
    } catch (err: any) {
      console.error('Image upload failed:', err)
      toast.error(err.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleCreateCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    try {
      if (!createForm.title.trim()) throw new Error('Title is required')
      if (!createForm.description.trim()) throw new Error('Description is required')
      if (!createForm.recipient_wallet_address.trim()) throw new Error('Recipient wallet is required')
      if (!createForm.release_date) throw new Error('Release date is required')

      const insertRow: Record<string, unknown> = {
        title: createForm.title.trim(),
        slug: `${slugify(createForm.title)}-${Date.now().toString(36)}`,
        description: createForm.description.trim(),
        image_url: createForm.image_url.trim() || null,
        video_url: createForm.video_url.trim() || null,
        goal_amount: createForm.goal_amount ? Number(createForm.goal_amount) : null,
        currency: 'XRP',
        recipient_wallet_address: createForm.recipient_wallet_address.trim(),
        release_date: new Date(createForm.release_date).toISOString(),
        status: createForm.status,
        network: createForm.network,
        submitted_by_user_id: user?.id,
        submitted_by_email: createForm.submitted_by_email.trim() || user?.email || null,
        submission_notes: createForm.submission_notes.trim() || null,
        admin_notes: createForm.admin_notes.trim() || null,
      }

      if (createForm.status !== 'under_review') {
        insertRow.approved_by = user?.id ?? null
        insertRow.approved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('campaigns')
        .insert(insertRow as any)
      if (error) throw error

      toast.success(`Campaign created: ${createForm.title}`)
      setCreateForm({
        title: '',
        description: '',
        image_url: '',
        video_url: '',
        goal_amount: '',
        recipient_wallet_address: '',
        release_date: '',
        network: 'testnet',
        status: 'under_review',
        submitted_by_email: user?.email ?? '',
        submission_notes: '',
        admin_notes: '',
      })
      setAddOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  const filtered = campaigns?.filter((c) => {
    if (activeTab === 'under_review') return c.status === 'under_review'
    if (activeTab === 'active') return c.status === 'active'
    return true
  }) ?? []

  const counts = {
    under_review: campaigns?.filter(c => c.status === 'under_review').length ?? 0,
    active:       campaigns?.filter(c => c.status === 'active').length ?? 0,
    completed:    campaigns?.filter(c => c.status === 'completed').length ?? 0,
    all:          campaigns?.length ?? 0,
  }
  const totalRaised = campaigns?.reduce((sum, c) => sum + (Number(c.total_raised) || 0), 0) ?? 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin Dashboard
        </button>

        {/* Header with inline Add CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Causes Management</h1>
              <p className="text-sm text-muted-foreground">Review submissions, approve campaigns, trigger escrow release</p>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)} className="h-10 gap-1.5 self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            Add Cause
          </Button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Under Review</p>
            <p className="text-2xl font-semibold mt-1">{counts.under_review}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> Active</p>
            <p className="text-2xl font-semibold mt-1">{counts.active}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Completed</p>
            <p className="text-2xl font-semibold mt-1">{counts.completed}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Total Raised</p>
            <p className="text-2xl font-semibold mt-1">{totalRaised.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">XRP</span></p>
          </Card>
        </div>


        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Add Cause
              </DialogTitle>
              <DialogDescription>
                Create a new campaign directly in the Causes system. Choose whether it starts as a draft (Under Review) or goes live immediately.
              </DialogDescription>
            </DialogHeader>


          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cause-title">Title</Label>
                <Input
                  id="cause-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Justice for the Northside 7"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-wallet">Recipient XRPL Wallet</Label>
                <Input
                  id="cause-wallet"
                  className="font-mono"
                  value={createForm.recipient_wallet_address}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, recipient_wallet_address: e.target.value }))}
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-release">Release Date</Label>
                <Input
                  id="cause-release"
                  type="datetime-local"
                  value={createForm.release_date}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, release_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-goal">Goal Amount (XRP)</Label>
                <Input
                  id="cause-goal"
                  type="number"
                  min="0"
                  step="0.000001"
                  value={createForm.goal_amount}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, goal_amount: e.target.value }))}
                  placeholder="50000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-network">Network</Label>
                <select
                  id="cause-network"
                  value={createForm.network}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, network: e.target.value as CampaignNetwork }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-status">Initial Status</Label>
                <select
                  id="cause-status"
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as CampaignStatus }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-image">Image URL</Label>
                <Input
                  id="cause-image"
                  type="url"
                  value={createForm.image_url}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause-video">Video URL</Label>
                <Input
                  id="cause-video"
                  type="url"
                  value={createForm.video_url}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cause-description">Description</Label>
                <Textarea
                  id="cause-description"
                  rows={5}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the cause, who it helps, and why it matters."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cause-notes">Submission Notes</Label>
                <Textarea
                  id="cause-notes"
                  rows={3}
                  value={createForm.submission_notes}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, submission_notes: e.target.value }))}
                  placeholder="Optional notes for the review team or public record."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cause-admin-notes">Admin Notes</Label>
                <Textarea
                  id="cause-admin-notes"
                  rows={3}
                  value={createForm.admin_notes}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, admin_notes: e.target.value }))}
                  placeholder="Internal notes not shown publicly."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Active campaigns appear on the public Causes page. Under review campaigns stay in admin until approved.
              </p>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Cause'}
              </Button>
            </div>
          </form>
          </DialogContent>
        </Dialog>


        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {([['under_review', 'Under Review'], ['active', 'Active'], ['all', 'All']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No campaigns in this category</p>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((campaign) => {
            const isExpanded = expandedId === campaign.id
            const badge = STATUS_BADGE[campaign.status]
            const releaseDate = new Date(campaign.release_date).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })
            const isPastRelease = new Date(campaign.release_date) < new Date()
            const isProcessing = processing === campaign.id

            return (
              <Card key={campaign.id} className="overflow-hidden">
                {/* Header row */}
                <div
                  className="p-5 flex items-start gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Submitted {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">{campaign.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{campaign.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {campaign.donor_count} donors · {campaign.total_raised} {campaign.currency} raised
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Releases {releaseDate}
                        {isPastRelease && <span className="text-amber-600 ml-1">(past due)</span>}
                      </span>
                      {campaign.submitted_by_email && (
                        <span>From: {campaign.submitted_by_email}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Quick actions */}
                    {campaign.status === 'under_review' && (
                      <>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleApprove(campaign.id) }}
                          disabled={!!isProcessing}
                          className="h-8 px-3"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span className="ml-1 hidden sm:inline">Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); setExpandedId(campaign.id) }}
                          disabled={!!isProcessing}
                          className="h-8 px-3"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="ml-1 hidden sm:inline">Reject</span>
                        </Button>
                      </>
                    )}
                    {campaign.status === 'active' && isPastRelease && campaign.donor_count > 0 && (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleRelease(campaign) }}
                        disabled={!!isProcessing}
                        className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span className="ml-1 hidden sm:inline">Release Funds</span>
                      </Button>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Recipient Wallet</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono break-all">{campaign.recipient_wallet_address}</code>
                          <a
                            href={`${explorerBase(campaign.network)}/accounts/${campaign.recipient_wallet_address}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:opacity-70 flex-shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Goal</p>
                        <p>{campaign.goal_amount ? `${campaign.goal_amount.toLocaleString()} ${campaign.currency}` : 'No goal set'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Full Description</p>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{campaign.description}</p>
                    </div>

                    {campaign.submission_notes && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Message from Applicant</p>
                        <p className="text-sm text-foreground whitespace-pre-line bg-card border border-border rounded-lg p-3">
                          {campaign.submission_notes}
                        </p>
                      </div>
                    )}

                    {/* Rejection form */}
                    {campaign.status === 'under_review' && (
                      <div className="border-t border-border pt-4 space-y-3">
                        <Label className="text-sm font-medium">Rejection Reason</Label>
                        <Textarea
                          placeholder="Required when rejecting — this will be on record."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(campaign.id)}
                            disabled={!!processing}
                            className="flex-1"
                          >
                            {processing === campaign.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              : <Check className="w-3.5 h-3.5 mr-1.5" />
                            }
                            Approve Campaign
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(campaign.id)}
                            disabled={!!processing || !rejectionReason.trim()}
                            className="flex-1"
                          >
                            {processing === campaign.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              : <X className="w-3.5 h-3.5 mr-1.5" />
                            }
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Release section */}
                    {campaign.status === 'active' && (
                      <div className="border-t border-border pt-4">
                        <div className="flex items-start gap-3 bg-card border border-border rounded-lg p-3">
                          <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Escrow Release</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isPastRelease
                                ? `Release date passed. ${campaign.donor_count} escrow(s) ready to release to recipient.`
                                : `Escrow releases on ${releaseDate}. Button appears when release date arrives.`
                              }
                            </p>
                            {isPastRelease && campaign.donor_count > 0 && (
                              <Button
                                size="sm"
                                className="mt-3 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleRelease(campaign)}
                                disabled={!!processing}
                              >
                                {processing === campaign.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                  : <Send className="w-3.5 h-3.5 mr-1.5" />
                                }
                                Release {campaign.donor_count} Escrow(s) → Recipient
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <a
                        href={`/causes/${campaign.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        View public page <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </main>

      <Footer />
    </div>
  )
}
