import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { ChevronRight, ChevronLeft, Upload, CheckCircle, Loader2 } from 'lucide-react'

const STEPS = ['Personal Info', 'Source of Funds', 'Documents', 'Review & Submit']

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'MX', name: 'Mexico' },
]

const SOURCE_OF_FUNDS_OPTIONS = [
  'Employment / Salary',
  'Business Income',
  'Investment Returns',
  'Inheritance / Gift',
  'Real Estate',
  'Savings',
  'Other',
]

const DOC_TYPES = [
  { key: 'government_id_front', label: 'Government ID (Front)' },
  { key: 'government_id_back', label: 'Government ID (Back)' },
  { key: 'selfie', label: 'Selfie with ID' },
]

interface FormData {
  legal_first_name: string
  legal_last_name: string
  date_of_birth: string
  nationality: string
  country_of_residence: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  country: string
  source_of_funds: string
}

const Kyc = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [kycCaseId, setKycCaseId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    legal_first_name: '',
    legal_last_name: '',
    date_of_birth: '',
    nationality: '',
    country_of_residence: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    source_of_funds: '',
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/auth')
      return
    }
    initKyc()
  }, [user, authLoading])

  const initKyc = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kyc-start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setKycCaseId(data.kyc_case_id)
      if (data.form_data) {
        setForm({
          legal_first_name: data.form_data.legal_first_name ?? '',
          legal_last_name: data.form_data.legal_last_name ?? '',
          date_of_birth: data.form_data.date_of_birth ?? '',
          nationality: data.form_data.nationality ?? '',
          country_of_residence: data.form_data.country_of_residence ?? '',
          address_line1: data.form_data.address_line1 ?? '',
          address_line2: data.form_data.address_line2 ?? '',
          city: data.form_data.city ?? '',
          state: data.form_data.state ?? '',
          postal_code: data.form_data.postal_code ?? '',
          country: data.form_data.country ?? '',
          source_of_funds: data.form_data.source_of_funds ?? '',
        })
      }
      // If already submitted/approved, redirect to status page
      if (['submitted', 'under_review', 'approved', 'rejected'].includes(data.status)) {
        navigate('/kyc/status')
      }
    } catch (err: any) {
      toast.error(`Failed to initialize KYC: ${err.message}`)
    } finally {
      setInitializing(false)
    }
  }

  const saveForm = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kyc-save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDocUpload = async (docType: string, file: File) => {
    if (!kycCaseId || !user) return
    setUploading(docType)
    try {
      const ext = file.name.split('.').pop()
      const path = `kyc/${user.id}/${kycCaseId}/${docType}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      // Record metadata
      await (supabase.from('kyc_documents') as any).upsert({
        kyc_case_id: kycCaseId,
        doc_type: docType,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
      }, { onConflict: 'kyc_case_id,doc_type' })

      setUploadedDocs(prev => ({ ...prev, [docType]: path }))
      toast.success('Document uploaded')
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(null)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kyc-submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.missing_fields) {
          toast.error(`Missing required fields: ${data.missing_fields.join(', ')}`)
          return
        }
        throw new Error(data.error)
      }
      toast.success('KYC application submitted!')
      navigate('/kyc/status')
    } catch (err: any) {
      toast.error(`Submission failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const nextStep = async () => {
    if (step < 2) await saveForm()
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  const prevStep = () => setStep(s => s - 1)

  const setField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  if (authLoading || initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Identity Verification</h1>
          <p className="text-muted-foreground text-sm">Complete KYC to unlock trading and minting</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              {STEPS.map((s, i) => (
                <span key={s} className={i === step ? 'text-primary font-medium' : ''}>{s}</span>
              ))}
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
          </div>
        </div>

        <Card className="p-6">
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Legal First Name *</Label>
                  <Input id="first_name" value={form.legal_first_name} onChange={e => setField('legal_first_name', e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <Label htmlFor="last_name">Legal Last Name *</Label>
                  <Input id="last_name" value={form.legal_last_name} onChange={e => setField('legal_last_name', e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input id="dob" type="date" value={form.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nationality *</Label>
                  <Select value={form.nationality} onValueChange={v => setField('nationality', v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Country of Residence *</Label>
                  <Select value={form.country_of_residence} onValueChange={v => setField('country_of_residence', v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="address1">Address Line 1 *</Label>
                <Input id="address1" value={form.address_line1} onChange={e => setField('address_line1', e.target.value)} placeholder="Street address" />
              </div>
              <div>
                <Label htmlFor="address2">Address Line 2</Label>
                <Input id="address2" value={form.address_line2} onChange={e => setField('address_line2', e.target.value)} placeholder="Apt, Suite, etc." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" value={form.city} onChange={e => setField('city', e.target.value)} placeholder="City" />
                </div>
                <div>
                  <Label htmlFor="state">State / Province</Label>
                  <Input id="state" value={form.state} onChange={e => setField('state', e.target.value)} placeholder="State" />
                </div>
                <div>
                  <Label htmlFor="postal">Postal Code *</Label>
                  <Input id="postal" value={form.postal_code} onChange={e => setField('postal_code', e.target.value)} placeholder="Postal code" />
                </div>
              </div>
              <div>
                <Label>Country *</Label>
                <Select value={form.country} onValueChange={v => setField('country', v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 1: Source of Funds */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Source of Funds</h2>
              <p className="text-sm text-muted-foreground">Please declare your primary source of funds for investment activity.</p>
              <div>
                <Label>Source of Funds *</Label>
                <Select value={form.source_of_funds} onValueChange={v => setField('source_of_funds', v)}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{SOURCE_OF_FUNDS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Document Upload */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
              <p className="text-sm text-muted-foreground">Upload clear photos of the following documents. All files are stored securely.</p>
              {DOC_TYPES.map(doc => (
                <div key={doc.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">{doc.label}</Label>
                    {uploadedDocs[doc.key] && <CheckCircle className="w-5 h-5 text-green-500" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id={`doc-${doc.key}`}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleDocUpload(doc.key, file)
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`doc-${doc.key}`)?.click()}
                      disabled={uploading === doc.key}
                    >
                      {uploading === doc.key ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploadedDocs[doc.key] ? 'Replace' : 'Upload'}
                    </Button>
                    {uploadedDocs[doc.key] && (
                      <span className="text-xs text-muted-foreground">Uploaded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Review & Submit</h2>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {form.legal_first_name} {form.legal_last_name}</p>
                <p><span className="font-medium">Date of Birth:</span> {form.date_of_birth}</p>
                <p><span className="font-medium">Nationality:</span> {form.nationality}</p>
                <p><span className="font-medium">Country of Residence:</span> {form.country_of_residence}</p>
                <p><span className="font-medium">Address:</span> {form.address_line1}, {form.city}, {form.postal_code}, {form.country}</p>
                <p><span className="font-medium">Source of Funds:</span> {form.source_of_funds}</p>
                <p><span className="font-medium">Documents:</span> {Object.keys(uploadedDocs).length} uploaded</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                By submitting, you confirm that all information provided is accurate and complete. False information may result in permanent account suspension.
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button variant="outline" onClick={prevStep} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Application
              </Button>
            )}
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default Kyc
