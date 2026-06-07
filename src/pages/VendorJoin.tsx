import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Building2, CheckCircle2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const LICENSED_OPTIONS = ['Licensed', 'Insured', 'Both', 'Neither'] as const
const BEST_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Anytime'] as const
const SERVES_RE_OPTIONS = ['Yes', 'No', 'Sometimes'] as const

const intakeSchema = z.object({
  full_name: z.string().trim().min(1, 'Required').max(120),
  business_name: z.string().trim().min(1, 'Required').max(200),
  phone: z.string().trim().min(7, 'Enter a valid phone').max(40),
  email: z.string().trim().email('Enter a valid email').max(255),
  city_service_area: z.string().trim().min(1, 'Required').max(200),
  occupation: z.string().trim().min(1, 'Required').max(200),
  licensed_status: z.enum(LICENSED_OPTIONS, { errorMap: () => ({ message: 'Choose one' }) }),
  best_time_to_contact: z.enum(BEST_TIME_OPTIONS, { errorMap: () => ({ message: 'Choose one' }) }),
  service_type: z.string().trim().max(200).optional(),
  serves_real_estate: z.enum(SERVES_RE_OPTIONS).optional(),
  service_description: z.string().trim().max(1000).optional(),
})

type IntakeForm = z.infer<typeof intakeSchema>

const initial: IntakeForm = {
  full_name: '',
  business_name: '',
  phone: '',
  email: '',
  city_service_area: '',
  occupation: '',
  licensed_status: 'Licensed',
  best_time_to_contact: 'Anytime',
  service_type: '',
  serves_real_estate: undefined,
  service_description: '',
}

export default function VendorJoin() {
  const [form, setForm] = useState<IntakeForm>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeForm, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function update<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = intakeSchema.safeParse(form)
    if (!parsed.success) {
      const next: Partial<Record<keyof IntakeForm, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof IntakeForm
        if (key && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      toast.error('Please complete the required fields.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await (supabase.from('vendor_leads') as any).insert({
        source: 'intake_join',
        vendor_profile_id: null,
        status: 'new',
        requester_name: parsed.data.full_name,
        requester_email: parsed.data.email.toLowerCase(),
        requester_phone: parsed.data.phone,
        business_name: parsed.data.business_name,
        city_service_area: parsed.data.city_service_area,
        occupation: parsed.data.occupation,
        licensed_status: parsed.data.licensed_status,
        best_time_to_contact: parsed.data.best_time_to_contact,
        service_needed: parsed.data.service_type || null,
        serves_real_estate: parsed.data.serves_real_estate ?? null,
        service_description: parsed.data.service_description || null,
        message: parsed.data.service_description || `Vendor intake submission from ${parsed.data.full_name}`,
      })
      if (error) throw error
      setConfirmOpen(true)
      setForm(initial)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Join the Accountabul Vendor Network</h1>
            <p className="text-sm text-muted-foreground">
              Tell us about your business. A member of our team will review your details and reach out within 7 days.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Intake</CardTitle>
            <CardDescription>Fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name *" error={errors.full_name}>
                  <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Business Name *" error={errors.business_name}>
                  <Input value={form.business_name} onChange={(e) => update('business_name', e.target.value)} autoComplete="organization" />
                </Field>
                <Field label="Phone Number *" error={errors.phone}>
                  <Input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" />
                </Field>
                <Field label="Email Address *" error={errors.email}>
                  <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" />
                </Field>
                <Field label="City / Service Area *" error={errors.city_service_area}>
                  <Input
                    value={form.city_service_area}
                    onChange={(e) => update('city_service_area', e.target.value)}
                    placeholder="e.g. Atlanta, GA"
                  />
                </Field>
                <Field label="Occupation / Trade *" error={errors.occupation}>
                  <Input
                    value={form.occupation}
                    onChange={(e) => update('occupation', e.target.value)}
                    placeholder="e.g. Electrician, CPA, Realtor"
                  />
                </Field>
              </div>

              <Field label="Licensed or Insured Status *" error={errors.licensed_status}>
                <RadioGroup
                  value={form.licensed_status}
                  onValueChange={(v) => update('licensed_status', v as IntakeForm['licensed_status'])}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {LICENSED_OPTIONS.map((opt) => (
                    <Label
                      key={opt}
                      htmlFor={`lic-${opt}`}
                      className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                    >
                      <RadioGroupItem id={`lic-${opt}`} value={opt} />
                      <span className="text-sm">{opt}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </Field>

              <Field label="Best Time to Contact You *" error={errors.best_time_to_contact}>
                <Select
                  value={form.best_time_to_contact}
                  onValueChange={(v) => update('best_time_to_contact', v as IntakeForm['best_time_to_contact'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BEST_TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Optional</h3>
                <div className="space-y-4">
                  <Field label="Type of Business or Services Offered">
                    <Input
                      value={form.service_type ?? ''}
                      onChange={(e) => update('service_type', e.target.value)}
                      placeholder="e.g. Residential HVAC repair & install"
                    />
                  </Field>

                  <Field label="Do you currently serve real estate investors, landlords, or property owners?">
                    <RadioGroup
                      value={form.serves_real_estate ?? ''}
                      onValueChange={(v) => update('serves_real_estate', v as IntakeForm['serves_real_estate'])}
                      className="grid grid-cols-3 gap-2"
                    >
                      {SERVES_RE_OPTIONS.map((opt) => (
                        <Label
                          key={opt}
                          htmlFor={`re-${opt}`}
                          className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                        >
                          <RadioGroupItem id={`re-${opt}`} value={opt} />
                          <span className="text-sm">{opt}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </Field>

                  <Field label="Short description of what you do">
                    <Textarea
                      value={form.service_description ?? ''}
                      onChange={(e) => update('service_description', e.target.value)}
                      placeholder="A sentence or two about your business and what makes you a good fit for our network."
                      className="min-h-[110px]"
                      maxLength={1000}
                    />
                  </Field>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <DialogTitle>Thank you</DialogTitle>
            <DialogDescription className="pt-2 text-sm">
              Your information has been submitted. A member of the Accountabul team will review your details and give you a
              call within the next 7 days.
              <span className="block mt-3 text-foreground">
                Would you like to also create a business account so you can track your application and unlock vendor tools?
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              No thanks
            </Button>
            <Button asChild>
              <Link to="/auth/vendor">Create Business Account</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
