import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, FileSignature, Wallet } from 'lucide-react';

const HowItWorksSection = () => {
  const pillars = [
    {
      icon: Building2,
      title: 'Post a listing',
      description: 'A business profile can publish a standard property listing with photos, price, and contact details. No tokenization involved.',
      status: 'Works today',
    },
    {
      icon: Users,
      title: 'Run a community campaign',
      description: 'Create a funding campaign, submit it for admin review, and track donations in the app.',
      status: 'Works today',
    },
    {
      icon: Wallet,
      title: 'Connect a wallet',
      description: 'Link an XRPL account through Xaman to view balances and prepare transactions. Public flows default to Testnet.',
      status: 'Works today',
    },
    {
      icon: FileSignature,
      title: 'Experiment with issuance',
      description: 'Build an MPT issuance definition on Testnet and sign it in Xaman. Distribution to holders is not implemented.',
      status: 'Experimental',
    },
  ];

  const steps = [
    {
      number: '1',
      title: 'Create an account',
      description: 'Sign up as an individual or a business. Business profiles unlock listing creation.',
    },
    {
      number: '2',
      title: 'Connect an XRPL wallet',
      description: 'Connect through Xaman. Your seed never leaves your wallet, and Testnet is the default network.',
    },
    {
      number: '3',
      title: 'List, fund, or experiment',
      description: 'Publish a listing, run a campaign, or try the Testnet issuance flow. Trading features are not available.',
    },
  ];

  return (
    <div className="py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">How the prototype works</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Four areas of the app you can actually use, with their current status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <Card key={index} className="group hover:shadow-glow transition-all duration-300 bg-card/50 backdrop-blur-sm border border-border/50">
                  <CardHeader className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl font-semibold">{pillar.title}</CardTitle>
                    <Badge variant="outline" className="mx-auto text-[10px]">{pillar.status}</Badge>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Getting started</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Three steps to try the prototype.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="space-y-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksSection;
