import { useMemo, useState } from 'react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Banknote,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  Trash2,
  Wrench,
} from 'lucide-react'

type ExpenseCategory =
  | 'Maintenance'
  | 'Utilities'
  | 'Cleaning'
  | 'Supplies'
  | 'Insurance'
  | 'Taxes'
  | 'Vendor'
  | 'Legal'
  | 'Marketing'
  | 'Other'

type ExpenseRow = {
  id: number
  date: string
  property: string
  category: ExpenseCategory
  vendor: string
  description: string
  paymentMethod: string
  amount: number
}

const categories: ExpenseCategory[] = [
  'Maintenance',
  'Utilities',
  'Cleaning',
  'Supplies',
  'Insurance',
  'Taxes',
  'Vendor',
  'Legal',
  'Marketing',
  'Other',
]

const initialRows: ExpenseRow[] = [
  {
    id: 1,
    date: '2026-07-05',
    property: 'Global Portfolio',
    category: 'Maintenance',
    vendor: 'Example Vendor',
    description: 'Daily property readiness check',
    paymentMethod: 'Card',
    amount: 0,
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

function escapeCsv(value: string | number) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function DailyOperatingExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>(initialRows)
  const [nextId, setNextId] = useState(2)

  const totals = useMemo(() => {
    const byCategory = categories.map((category) => ({
      category,
      total: rows.filter((row) => row.category === category).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }))
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const properties = new Set(rows.map((row) => row.property).filter(Boolean)).size
    return { byCategory, total, properties }
  }, [rows])

  const addRow = () => {
    const today = new Date().toISOString().slice(0, 10)
    setRows((current) => [
      ...current,
      {
        id: nextId,
        date: today,
        property: '',
        category: 'Other',
        vendor: '',
        description: '',
        paymentMethod: '',
        amount: 0,
      },
    ])
    setNextId((id) => id + 1)
  }

  const updateRow = <K extends keyof ExpenseRow>(id: number, key: K, value: ExpenseRow[K]) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  }

  const removeRow = (id: number) => {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)))
  }

  const exportCsv = () => {
    const headers = ['Date', 'Property', 'Category', 'Vendor', 'Description', 'Payment Method', 'Amount']
    const lines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) =>
        [
          row.date,
          row.property,
          row.category,
          row.vendor,
          row.description,
          row.paymentMethod,
          row.amount.toFixed(2),
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `daily-operating-expenses-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <Badge variant="secondary" className="gap-2 px-3 py-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Daily Operating Expense Sheet
                </Badge>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-foreground">DOE Worksheet</h1>
                  <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                    Track daily property operating costs by property, category, vendor, payment method, and amount.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={addRow}>
                  <Plus className="h-4 w-4" />
                  Add expense
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  Total daily spend
                </CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(totals.total)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-primary" />
                  Expense lines
                </CardDescription>
                <CardTitle className="text-3xl">{rows.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Properties touched
                </CardDescription>
                <CardTitle className="text-3xl">{totals.properties}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Daily Entries</CardTitle>
              <CardDescription>Use one line per receipt, vendor bill, cash item, or operating adjustment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border border-border bg-card p-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`date-${row.id}`}>Date</Label>
                      <Input
                        id={`date-${row.id}`}
                        type="date"
                        value={row.date}
                        onChange={(event) => updateRow(row.id, 'date', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`property-${row.id}`}>Property</Label>
                      <Input
                        id={`property-${row.id}`}
                        value={row.property}
                        onChange={(event) => updateRow(row.id, 'property', event.target.value)}
                        placeholder="Property or portfolio"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={row.category} onValueChange={(value) => updateRow(row.id, 'category', value as ExpenseCategory)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`amount-${row.id}`}>Amount</Label>
                      <Input
                        id={`amount-${row.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => updateRow(row.id, 'amount', Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`vendor-${row.id}`}>Vendor</Label>
                      <Input
                        id={`vendor-${row.id}`}
                        value={row.vendor}
                        onChange={(event) => updateRow(row.id, 'vendor', event.target.value)}
                        placeholder="Vendor, staff, utility, or payee"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`payment-${row.id}`}>Payment Method</Label>
                      <Input
                        id={`payment-${row.id}`}
                        value={row.paymentMethod}
                        onChange={(event) => updateRow(row.id, 'paymentMethod', event.target.value)}
                        placeholder="Card, ACH, cash, wallet"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        aria-label="Remove expense row"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`description-${row.id}`}>Description</Label>
                    <Textarea
                      id={`description-${row.id}`}
                      value={row.description}
                      onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                      placeholder="Receipt note, work performed, approval status, or property manager comment"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Category Totals
                </CardTitle>
                <CardDescription>Quick operating view by spend bucket.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {totals.byCategory
                  .filter((item) => item.total > 0)
                  .map((item) => (
                    <div key={item.category} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                {totals.total === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Add expense amounts to populate totals.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Global Packet Attachment</CardTitle>
                <CardDescription>This DOE sheet is paired with the portal legal packet for operating readiness.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Use the Legal category for legal packet generation, privacy reviews, trademark searches, policy updates, and compliance support.</p>
                <p>Exported CSV files can be attached to monthly operating folders, bookkeeping records, or property-level reports.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
