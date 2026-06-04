import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, GripVertical, Eye, EyeOff, Star, ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useAllMembershipTiers, useUpdateTier, type MembershipTier } from '@/hooks/useMembershipTiers'
import { useAuth } from '@/hooks/useAuth'
import { useTeamAccess } from '@/hooks/useTeamAccess'
import { toast } from 'sonner'

function TierEditor({ tier }: { tier: MembershipTier }) {
  const updateTier = useUpdateTier()
  const [draft, setDraft] = useState<MembershipTier>({ ...tier })
  const [newFeature, setNewFeature] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(tier)

  function updateField<K extends keyof MembershipTier>(key: K, value: MembershipTier[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function addFeature() {
    const trimmed = newFeature.trim()
    if (!trimmed) return
    updateField('features', [...(draft.features as string[]), trimmed])
    setNewFeature('')
  }

  function removeFeature(index: number) {
    updateField('features', (draft.features as string[]).filter((_, i) => i !== index))
  }

  async function save() {
    try {
      await updateTier.mutateAsync({
        id: draft.id,
        name: draft.name,
        price_monthly: draft.price_monthly,
        price_annual: draft.price_annual,
        description: draft.description,
        features: draft.features,
        highlight_feature: draft.highlight_feature,
        is_popular: draft.is_popular,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
        cta_label: draft.cta_label,
        stripe_price_lookup_monthly: draft.stripe_price_lookup_monthly,
        stripe_price_lookup_annual: draft.stripe_price_lookup_annual,
      })
      toast.success(`${draft.name} tier saved`)
    } catch {
      toast.error('Failed to save tier')
    }
  }

  return (
    <Card className={`p-6 border ${!draft.is_active ? 'opacity-60 border-dashed' : draft.is_popular ? 'border-primary/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">{tier.name}</span>
          {draft.is_popular && <Badge className="bg-primary/10 text-primary border-primary/20">Popular</Badge>}
          {!draft.is_active && <Badge variant="secondary">Hidden</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateField('is_popular', !draft.is_popular)}
            title={draft.is_popular ? 'Remove popular badge' : 'Mark as popular'}
          >
            <Star className={`w-4 h-4 ${draft.is_popular ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateField('is_active', !draft.is_active)}
            title={draft.is_active ? 'Hide from public' : 'Show to public'}
          >
            {draft.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </Button>
          <Button
            size="sm"
            disabled={!dirty || updateTier.isPending}
            onClick={save}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tier Name</Label>
          <Input value={draft.name} onChange={e => updateField('name', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">CTA Button Label</Label>
          <Input value={draft.cta_label} onChange={e => updateField('cta_label', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Monthly Price ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={draft.price_monthly}
            onChange={e => updateField('price_monthly', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Annual Price ($) — full year charge</Label>
          <Input
            type="number"
            step="0.01"
            value={draft.price_annual ?? ''}
            onChange={e => updateField('price_annual', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Leave blank to hide annual option"
          />
        </div>
      </div>

      <div className="mb-4">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
        <Textarea
          rows={2}
          value={draft.description ?? ''}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Short description shown under tier name"
        />
      </div>

      <div className="mb-4">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Highlight Feature (shown with lightning bolt)</Label>
        <Input
          value={draft.highlight_feature ?? ''}
          onChange={e => updateField('highlight_feature', e.target.value || null)}
          placeholder="e.g. Deed fraud monitoring included"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Stripe price lookup key (monthly)</Label>
          <Input
            value={draft.stripe_price_lookup_monthly ?? ''}
            onChange={e => updateField('stripe_price_lookup_monthly', e.target.value || null)}
            placeholder="e.g. accountabul_starter_monthly"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Stripe price lookup key (annual)</Label>
          <Input
            value={draft.stripe_price_lookup_annual ?? ''}
            onChange={e => updateField('stripe_price_lookup_annual', e.target.value || null)}
            placeholder="e.g. accountabul_starter_annual"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Features List</Label>
        <div className="space-y-2 mb-3">
          {(draft.features as string[]).map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-sm flex-1">{f}</span>
              <button
                onClick={() => removeFeature(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newFeature}
            onChange={e => setNewFeature(e.target.value)}
            placeholder="Add a feature..."
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
          />
          <Button variant="outline" size="sm" onClick={addFeature}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default function AdminPricing() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useTeamAccess()
  const { data: tiers, isLoading } = useAllMembershipTiers()

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Access denied.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Membership Tiers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Changes save immediately and appear on the public pricing page.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/pricing')} className="gap-1.5">
            <Eye className="w-4 h-4" />
            Preview Public Page
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {tiers?.map(tier => (
              <TierEditor key={tier.id} tier={tier} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
