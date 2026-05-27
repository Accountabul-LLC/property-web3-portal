import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Send, CheckCircle2, Lock, Info, AlertTriangle, Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useActiveWallet } from '@/contexts/ActiveWalletContext'
import { AcceptedAssetsPicker, type SupportedAsset } from '@/components/causes/AcceptedAssetsPicker'
import { toast } from 'sonner'

const schema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(100),
  description: z.string().min(50, 'Please provide at least 50 characters describing the cause').max(5000),
  recipient_wallet_address: z
    .string()
    .regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'Must be a valid XRPL r-address (starts with r)'),
  goal_amount: z.string().optional(),
  accepted_assets: z.array(z.enum(['XRP', 'RLUSD'])).min(1).default(['XRP']),
  release_date: z.string().optional(),
  image_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  contact_email: z.string().email('Must be a valid email'),
  submission_notes: z.string().min(20, 'Please tell us more about this cause (min 20 chars)').max(2000),
}).refine(
  (data) => {
    // Release date required only in scheduled (XRP-only) mode
    const isDirect = data.accepted_assets.some((a) => a !== 'XRP')
    if (isDirect) return true
    return !!data.release_date
  },
  { message: 'Please select a release date', path: ['release_date'] },
)

type FormValues = z.infer<typeof schema>

export default function CauseApply() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { activeAddress } = useActiveWallet()
  const [submitted, setSubmitted] = useState(false)

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 30)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      recipient_wallet_address: '',
      goal_amount: '',
      accepted_assets: ['XRP'],
      release_date: '',
      image_url: '',
      contact_email: user?.email ?? '',
      submission_notes: '',
    },
  })

  const acceptedAssets = form.watch('accepted_assets')
  const recipientAddress = form.watch('recipient_wallet_address')
  const isDirectMode = acceptedAssets.some((a) => a !== 'XRP')
  const recipientDiffersFromConnected =
    !!activeAddress && !!recipientAddress && recipientAddress !== activeAddress

  // Default recipient to connected wallet once known (if user hasn't typed yet)
  useEffect(() => {
    if (activeAddress && !form.getValues('recipient_wallet_address')) {
      form.setValue('recipient_wallet_address', activeAddress, { shouldValidate: false })
    }
  }, [activeAddress, form])

  // Clear release_date when switching to direct mode
  useEffect(() => {
    if (isDirectMode && form.getValues('release_date')) {
      form.setValue('release_date', '', { shouldValidate: false })
    }
  }, [isDirectMode, form])

  async function onSubmit(values: FormValues) {
    try {
      const isDirect = values.accepted_assets.some((a) => a !== 'XRP')
      const { data, error } = await supabase.functions.invoke('campaign-submit', {
        body: {
          title: values.title,
          description: values.description,
          recipient_wallet_address: values.recipient_wallet_address,
          goal_amount: values.goal_amount ? parseFloat(values.goal_amount) : null,
          accepted_assets: values.accepted_assets,
          campaign_mode: isDirect ? 'evergreen' : 'scheduled',
          release_date: isDirect ? null : new Date(values.release_date!).toISOString(),
          image_url: values.image_url || null,
          contact_email: values.contact_email,
          submission_notes: values.submission_notes,
        },
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to submit')
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex items-center">
          <div className="w-full bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Sign in to submit a cause</h1>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Campaign submissions are reviewed by the Accountabul civil division, and
              submissions must be tied to a signed-in account.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/auth')}>Sign In</Button>
              <Button variant="outline" onClick={() => navigate('/causes')}>
                Back to Causes
              </Button>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Submission Received</h2>
            <p className="text-muted-foreground mb-2">
              Thank you for submitting your cause. The Accountabul civil division will review it
              and reach out to you at the email you provided.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Review typically takes 3–5 business days. If approved, your campaign will go live on the Causes page.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/causes')}>View Active Causes</Button>
              <Button variant="outline" onClick={() => { setSubmitted(false); form.reset() }}>
                Submit Another
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <button
          onClick={() => navigate('/causes')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Causes
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Submit a Cause</h1>
          <p className="text-muted-foreground">
            All campaigns are reviewed by the Accountabul civil division before going live.
            We focus on social justice, community defense, and civil rights causes.
          </p>
        </div>

        {/* Info banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3 mb-8">
          <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">How funds work:</strong> Every donation goes into XRPL escrow — locked on-chain until your release date, then sent directly to your wallet. The Accountabul team never holds the funds.</p>
            <p className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              You must provide a valid XRPL wallet address to receive funds.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Title *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Justice for Marcus Johnson Defense Fund" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the cause, who it helps, and why it matters. Be specific — this is what donors will read."
                    rows={6}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="recipient_wallet_address" render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient XRPL Wallet Address *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="font-mono"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {activeAddress
                    ? 'Defaults to your connected wallet. Edit if funds should go elsewhere.'
                    : 'Must be a valid XRPL r-address. This is where funds will be sent.'}
                </p>
                {recipientDiffersFromConnected && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>
                      Accepted assets are based on <strong>your</strong> connected wallet's trustlines, not the recipient's. Make sure the recipient also has the required trustlines before going live.
                    </p>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {/* Accepted assets picker */}
            <FormField control={form.control} name="accepted_assets" render={({ field }) => (
              <FormItem>
                <AcceptedAssetsPicker
                  value={field.value as SupportedAsset[]}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="goal_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Amount (XRP, optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g. 50000" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Shown as a soft goal — donations continue past the goal.</p>
                  <FormMessage />
                </FormItem>
              )} />

              {isDirectMode ? (
                <div className="flex flex-col justify-center rounded-md border border-dashed border-border bg-muted/20 p-3">
                  <p className="text-sm font-medium text-foreground">Direct mode</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Donations forward to the recipient immediately. No release date — required because non-XRP assets can't be escrowed on XRPL.
                  </p>
                </div>
              ) : (
                <FormField control={form.control} name="release_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escrow Release Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={minDate.toISOString().split('T')[0]}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Minimum 30 days from today.</p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>


            <FormField control={form.control} name="image_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Image URL (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="border-t border-border pt-6">
              <h3 className="font-medium text-foreground mb-4">Contact & Review</h3>

              <FormField control={form.control} name="contact_email" render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Contact Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">We'll reach out here with approval status.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="submission_notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Message to Review Team *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us more about this cause — who is involved, any urgency, links to news coverage, legal documents, etc."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </form>
        </Form>
      </main>

      <Footer />
    </div>
  )
}
