import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { WalletCards, ReceiptText, Building2, ScanSearch } from "lucide-react";

import {
  attachmentReferenceLabel,
  PAYMENT_ATTACHMENT_OPTIONS,
  PAYMENT_CURRENCIES,
  PAYMENT_FLOW_OPTIONS,
  PAYMENT_RAIL_OPTIONS,
} from "./paymentUtils";
import type { PaymentDraft, PaymentRail } from "./paymentTypes";

type PaymentComposerProps = {
  draft: PaymentDraft;
  busy: boolean;
  onChange: (field: keyof PaymentDraft, value: string) => void;
  onCheckout: (rail: PaymentRail) => void;
};

function PaymentIcon({ type }: { type: PaymentDraft["attachmentType"] }) {
  switch (type) {
    case "business":
      return <Building2 className="h-4 w-4" />;
    case "wallet":
      return <WalletCards className="h-4 w-4" />;
    case "location":
      return <ScanSearch className="h-4 w-4" />;
    case "person":
    default:
      return <ReceiptText className="h-4 w-4" />;
  }
}

export function PaymentComposer({ draft, busy, onChange, onCheckout }: PaymentComposerProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Create payment or invoice
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Wallet and card rails only
          </Badge>
        </div>
        <CardTitle className="text-2xl">Build the payment request</CardTitle>
        <CardDescription>
          Add the amount, currency, and target entity first. Then hand the request to either connected wallet or card
          payment handoff. This flow is structured for payments and invoices, not donation or generic send/receive wording.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_180px]">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={draft.amount}
              onChange={(e) => onChange("amount", e.target.value)}
              placeholder="150.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-currency">Currency</Label>
            <Select value={draft.currency} onValueChange={(value) => onChange("currency", value)}>
              <SelectTrigger id="payment-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-flow">Request type</Label>
          <Select value={draft.flow} onValueChange={(value) => onChange("flow", value)}>
            <SelectTrigger id="payment-flow">
              <SelectValue placeholder="Select request type" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_FLOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-attachment-type">Attach to</Label>
            <Select value={draft.attachmentType} onValueChange={(value) => onChange("attachmentType", value)}>
              <SelectTrigger id="payment-attachment-type">
                <SelectValue placeholder="Select a target" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_ATTACHMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-attachment-label">Target label</Label>
            <Input
              id="payment-attachment-label"
              value={draft.attachmentLabel}
              onChange={(e) => onChange("attachmentLabel", e.target.value)}
              placeholder="Acme Operations, Tenant A, Wallet 04"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="payment-attachment-reference">{attachmentReferenceLabel(draft.attachmentType)}</Label>
            <Input
              id="payment-attachment-reference"
              value={draft.attachmentReference}
              onChange={(e) => onChange("attachmentReference", e.target.value)}
              placeholder={
                draft.attachmentType === "wallet"
                  ? "0xabc123..."
                  : draft.attachmentType === "person"
                    ? "tenant@example.com"
                    : draft.attachmentType === "business"
                      ? "vendor-245"
                      : "property-12"
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payer-name">Payer name</Label>
            <Input
              id="payer-name"
              value={draft.payerName}
              onChange={(e) => onChange("payerName", e.target.value)}
              placeholder="Jordan Lee"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-email">Payer email</Label>
            <Input
              id="payer-email"
              type="email"
              value={draft.payerEmail}
              onChange={(e) => onChange("payerEmail", e.target.value)}
              placeholder="jordan@company.com"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoice-number">Invoice reference</Label>
            <Input
              id="invoice-number"
              value={draft.invoiceNumber}
              onChange={(e) => onChange("invoiceNumber", e.target.value)}
              placeholder="INV-1042"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-memo">Memo</Label>
            <Input
              id="payment-memo"
              value={draft.memo}
              onChange={(e) => onChange("memo", e.target.value)}
              placeholder="January rent, consulting retainer, or service fee"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <PaymentIcon type={draft.attachmentType} />
            Payments are structured around an entity, not a donation or a generic transfer.
          </div>
          <p className="mt-1">
            This draft stays client-thin. Settlement logic, wallet signatures, and Stripe payment session creation stay
            behind the backend contract.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {PAYMENT_RAIL_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              onClick={() => onCheckout(option.value)}
              disabled={busy}
              className="min-w-44"
              variant={option.value === "card" ? "default" : "secondary"}
            >
              <div className="flex flex-col items-start text-left">
                <span>{busy ? "Preparing..." : option.label}</span>
                <span className="text-xs font-normal opacity-80">{option.description}</span>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
