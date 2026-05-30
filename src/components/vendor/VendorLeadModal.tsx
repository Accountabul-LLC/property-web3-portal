import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface VendorLeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorProfileId: string
  vendorName: string
}

export function VendorLeadModal({
  open,
  onOpenChange,
  vendorProfileId,
  vendorName,
}: VendorLeadModalProps) {
  const { user } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    property_address: '',
    service_needed: '',
    message: '',
  })

  function handleClose(open: boolean) {
    if (!open) {
      // Reset on close (with small delay so animation completes)
      setTimeout(() => {
        setSubmitted(false)
        setForm({
          requester_name: '',
          requester_email: '',
          requester_phone: '',
          property_address: '',
          service_needed: '',
          message: '',
        })
      }, 300)
    }
    onOpenChange(open)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.requester_name.trim() || !form.requester_email.trim()) {
      toast.error('Name and email are required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        vendor_profile_id: vendorProfileId,
        requester_user_id: user?.id ?? null,
        requester_name: form.requester_name.trim(),
        requester_email: form.requester_email.trim(),
        requester_phone: form.requester_phone.trim() || null,
        property_address: form.property_address.trim() || null,
        service_needed: form.service_needed.trim() || null,
        message: form.message.trim() || null,
        source: 'vendor_directory',
        status: 'new',
      }

      const { error } = await (supabase as any).from('vendor_leads').insert(payload)
      if (error) throw error

      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <DialogTitle>Message sent!</DialogTitle>
            <DialogDescription>
              Your message was sent to <strong>{vendorName}</strong>. They will be in touch with you shortly.
            </DialogDescription>
            <Button onClick={() => handleClose(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact {vendorName}</DialogTitle>
              <DialogDescription>
                Send a message directly to this vendor. They will receive your contact details and reply to you.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Your Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.requester_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, requester_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={form.requester_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, requester_email: e.target.value }))}
                    placeholder="jane@email.com"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input
                    type="tel"
                    value={form.requester_phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, requester_phone: e.target.value }))}
                    placeholder="(555) 000-0000"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Service Needed</Label>
                <Input
                  value={form.service_needed}
                  onChange={(e) => setForm((prev) => ({ ...prev, service_needed: e.target.value }))}
                  placeholder="e.g. Electrical inspection, Title search, Appraisal..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Property Address (optional)</Label>
                <Input
                  value={form.property_address}
                  onChange={(e) => setForm((prev) => ({ ...prev, property_address: e.target.value }))}
                  placeholder="123 Main St, St. Louis, MO 63101"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Tell the vendor what you need..."
                  className="mt-1 min-h-[80px]"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send Message
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
