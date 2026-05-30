import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface VendorLeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorProfileId: string
  vendorName: string
  source?: string
}

export function VendorLeadModal({ open, onOpenChange, vendorProfileId, vendorName, source = 'vendor_directory' }: VendorLeadModalProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    service_needed: '',
    message: '',
  })

  useEffect(() => {
    if (!open) return
    setForm((prev) => ({
      ...prev,
      requester_email: prev.requester_email || user?.email || '',
    }))
  }, [open, user?.email])

  if (!open) return null

  const handleSubmit = async () => {
    if (!form.requester_name.trim() || !form.requester_email.trim() || !form.service_needed.trim() || !form.message.trim()) {
      toast.error('Please complete the required fields.')
      return
    }

    setSaving(true)
    try {
      const { error } = await (supabase.from('vendor_leads') as any).insert({
        vendor_profile_id: vendorProfileId,
        requester_user_id: user?.id ?? null,
        requester_name: form.requester_name.trim(),
        requester_email: form.requester_email.trim(),
        requester_phone: form.requester_phone.trim() || null,
        service_needed: form.service_needed.trim(),
        message: form.message.trim(),
        source,
      })
      if (error) throw error
      toast.success(`Your message was sent. ${vendorName} will be in touch.`)
      onOpenChange(false)
      setForm({
        requester_name: '',
        requester_email: user?.email || '',
        requester_phone: '',
        service_needed: '',
        message: '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Contact {vendorName}</h3>
            <p className="text-sm text-muted-foreground">Send a lead request to this verified vendor.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Your Name</Label>
              <Input value={form.requester_name} onChange={(e) => setForm((prev) => ({ ...prev, requester_name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Your Email</Label>
              <Input type="email" value={form.requester_email} onChange={(e) => setForm((prev) => ({ ...prev, requester_email: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input value={form.requester_phone} onChange={(e) => setForm((prev) => ({ ...prev, requester_phone: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Service Needed</Label>
            <Input value={form.service_needed} onChange={(e) => setForm((prev) => ({ ...prev, service_needed: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={form.message} onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))} className="mt-1 min-h-[120px]" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Message
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

