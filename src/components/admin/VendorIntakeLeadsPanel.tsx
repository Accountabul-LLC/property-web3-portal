import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, Download, Inbox, Phone, Mail, MapPin, Briefcase, ShieldCheck, Clock3, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  INTAKE_LEAD_STATUSES,
  INTAKE_STATUS_LABELS,
  type IntakeLeadStatus,
  type VendorIntakeLead,
  useUpdateIntakeLead,
  useVendorIntakeLeads,
} from '@/hooks/useVendorIntakeLeads'

function statusTone(status: IntakeLeadStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'new':
      return 'default'
    case 'contacted':
      return 'secondary'
    case 'interested':
      return 'default'
    case 'approved':
      return 'default'
    case 'rejected':
    case 'not_interested':
      return 'destructive'
    default:
      return 'outline'
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

function toCsv(rows: VendorIntakeLead[]) {
  const headers = [
    'submitted_at',
    'status',
    'full_name',
    'business_name',
    'email',
    'phone',
    'city_service_area',
    'occupation',
    'licensed_status',
    'best_time_to_contact',
    'serves_real_estate',
    'service_type',
    'service_description',
    'internal_notes',
    'follow_up_date',
  ]
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.status,
        r.requester_name,
        r.business_name,
        r.requester_email,
        r.requester_phone,
        r.city_service_area,
        r.occupation,
        r.licensed_status,
        r.best_time_to_contact,
        r.serves_real_estate,
        r.service_needed,
        r.service_description,
        r.internal_notes,
        r.follow_up_date,
      ]
        .map(esc)
        .join(','),
    )
  }
  return lines.join('\n')
}

export default function VendorIntakeLeadsPanel() {
  const { data: leads = [], isLoading, refetch } = useVendorIntakeLeads()
  const updateMutation = useUpdateIntakeLead()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IntakeLeadStatus | 'all'>('all')
  const [cityFilter, setCityFilter] = useState('')
  const [occupationFilter, setOccupationFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [openId, setOpenId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')
  const [draftFollowUp, setDraftFollowUp] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (cityFilter.trim() && !(l.city_service_area ?? '').toLowerCase().includes(cityFilter.trim().toLowerCase())) return false
      if (occupationFilter.trim() && !(l.occupation ?? '').toLowerCase().includes(occupationFilter.trim().toLowerCase())) return false
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        if (new Date(l.created_at) > end) return false
      }
      if (needle) {
        const hay = [
          l.requester_name,
          l.business_name,
          l.requester_email,
          l.requester_phone,
          l.city_service_area,
          l.occupation,
          l.service_needed,
          l.service_description,
          l.internal_notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [leads, search, statusFilter, cityFilter, occupationFilter, dateFrom, dateTo])

  const open = openId ? leads.find((l) => l.id === openId) ?? null : null

  function openLead(lead: VendorIntakeLead) {
    setOpenId(lead.id)
    setDraftNotes(lead.internal_notes ?? '')
    setDraftFollowUp(lead.follow_up_date ?? '')
  }

  async function setStatus(lead: VendorIntakeLead, status: IntakeLeadStatus) {
    try {
      await updateMutation.mutateAsync({ id: lead.id, patch: { status } })
      toast.success(`Status updated to "${INTAKE_STATUS_LABELS[status]}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function saveDetails() {
    if (!open) return
    try {
      await updateMutation.mutateAsync({
        id: open.id,
        patch: {
          internal_notes: draftNotes || null,
          follow_up_date: draftFollowUp || null,
        },
      })
      toast.success('Lead updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  function exportCsv() {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vendor-intake-leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const counts: Record<IntakeLeadStatus | 'all', number> = {
    all: leads.length,
    new: 0,
    contacted: 0,
    interested: 0,
    not_interested: 0,
    approved: 0,
    rejected: 0,
  }
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Vendor Intake Leads</CardTitle>
                <CardDescription>Submissions from the public "Join the Network" form.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <StatTile label="All" value={counts.all} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            {INTAKE_LEAD_STATUSES.map((s) => (
              <StatTile
                key={s}
                label={INTAKE_STATUS_LABELS[s]}
                value={counts[s] ?? 0}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, business..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Input placeholder="City / area" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            <Input placeholder="Occupation" value={occupationFilter} onChange={(e) => setOccupationFilter(e.target.value)} />
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No intake leads match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Submitted</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Business</th>
                    <th className="text-left p-3">City</th>
                    <th className="text-left p-3">Occupation</th>
                    <th className="text-left p-3">Licensed</th>
                    <th className="text-left p-3">Best Time</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t cursor-pointer hover:bg-accent/40"
                      onClick={() => openLead(l)}
                    >
                      <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{l.requester_name ?? '-'}</td>
                      <td className="p-3">{l.business_name ?? '-'}</td>
                      <td className="p-3">{l.city_service_area ?? '-'}</td>
                      <td className="p-3">{l.occupation ?? '-'}</td>
                      <td className="p-3">{l.licensed_status ?? '-'}</td>
                      <td className="p-3">{l.best_time_to_contact ?? '-'}</td>
                      <td className="p-3">
                        <Badge variant={statusTone(l.status)}>{INTAKE_STATUS_LABELS[l.status] ?? l.status}</Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap">{l.follow_up_date ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{open.requester_name ?? 'Vendor lead'}</DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(open.created_at)} - last updated {formatDate(open.updated_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail icon={<Mail className="w-4 h-4" />} label="Email" value={open.requester_email} />
                  <Detail icon={<Phone className="w-4 h-4" />} label="Phone" value={open.requester_phone} />
                  <Detail icon={<Briefcase className="w-4 h-4" />} label="Business" value={open.business_name} />
                  <Detail icon={<MapPin className="w-4 h-4" />} label="City / Service Area" value={open.city_service_area} />
                  <Detail icon={<Briefcase className="w-4 h-4" />} label="Occupation / Trade" value={open.occupation} />
                  <Detail icon={<ShieldCheck className="w-4 h-4" />} label="Licensed / Insured" value={open.licensed_status} />
                  <Detail icon={<Clock3 className="w-4 h-4" />} label="Best Time" value={open.best_time_to_contact} />
                  <Detail icon={<Briefcase className="w-4 h-4" />} label="Serves real estate" value={open.serves_real_estate} />
                </div>

                {(open.service_needed || open.service_description) && (
                  <>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      {open.service_needed && (
                        <div>
                          <div className="text-xs text-muted-foreground">Type of services</div>
                          <div className="font-medium">{open.service_needed}</div>
                        </div>
                      )}
                      {open.service_description && (
                        <div>
                          <div className="text-xs text-muted-foreground">Description</div>
                          <p className="font-medium whitespace-pre-wrap">{open.service_description}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={open.status} onValueChange={(v) => setStatus(open, v as IntakeLeadStatus)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTAKE_LEAD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {INTAKE_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Follow-up date
                    </Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={draftFollowUp}
                      onChange={(e) => setDraftFollowUp(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Internal notes</Label>
                  <Textarea
                    className="mt-1 min-h-[120px]"
                    placeholder="Notes from calls, follow-ups, decisions..."
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpenId(null)}>
                    Close
                  </Button>
                  <Button onClick={saveDetails} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: number
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </button>
  )
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-all">{value ?? '-'}</div>
      </div>
    </div>
  )
}
