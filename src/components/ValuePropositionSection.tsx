import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, CircleDashed, FlaskConical } from 'lucide-react';

type StatusKind = 'working' | 'experimental' | 'planned';

const STATUS_META: Record<StatusKind, { label: string; icon: React.ElementType }> = {
  working: { label: 'Works today', icon: CheckCircle2 },
  experimental: { label: 'Experimental', icon: FlaskConical },
  planned: { label: 'Planned', icon: CircleDashed },
};

const ValuePropositionSection = () => {
  const capabilities: { title: string; description: string; status: StatusKind }[] = [
    {
      title: 'Accounts, roles, and admin review',
      description: 'Email and Google sign-in, business profiles, identity verification workflow, and admin review queues.',
      status: 'working',
    },
    {
      title: 'Standard property listings',
      description: 'Business profiles can post regular, non-tokenized property listings with photos and contact details.',
      status: 'working',
    },
    {
      title: 'Community funding campaigns',
      description: 'Campaign creation, review, and donation tracking inside the app.',
      status: 'working',
    },
    {
      title: 'Wallet connectivity and signing',
      description: 'Connect an XRPL account with Xaman. Transactions are built server-side and signed in your wallet.',
      status: 'working',
    },
    {
      title: 'XRPL issuance definition (MPT)',
      description: 'Creates an MPT issuance definition on XRPL Testnet. Holder authorization and distribution are not implemented.',
      status: 'experimental',
    },
    {
      title: 'Secondary trading, order book, pools',
      description: 'Buying, selling, order placement, swaps, and liquidity pools are not functional and are disabled in the UI.',
      status: 'planned',
    },
  ];

  return (
    <div className="py-24 px-4 bg-muted/20">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold">What this prototype actually does</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            An honest status list. Anything not marked as working today is either experimental or still on the roadmap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((capability) => {
            const meta = STATUS_META[capability.status];
            const Icon = meta.icon;
            return (
              <Card key={capability.title} className="border-border/60 bg-background/70">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                    <Badge variant="secondary" className="text-xs">{meta.label}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{capability.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{capability.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground max-w-3xl mx-auto">
          Accountabul is not registered with any securities regulator, is not audited, and holds no insurance. Public
          wallet flows default to XRPL Testnet. Do your own research before acting on anything you see here.
        </p>
      </div>
    </div>
  );
};

export default ValuePropositionSection;
