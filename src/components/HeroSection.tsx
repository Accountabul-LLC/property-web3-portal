import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Briefcase, FileSignature, FlaskConical, ListChecks, Wallet } from 'lucide-react';
import PrototypeNotice from '@/components/PrototypeNotice';
import heroImage from '@/assets/hero-image.jpg';

interface HeroSectionProps {
  onGetStarted: () => void;
  onExploreMarketplace: () => void;
}

const HeroSection = ({ onGetStarted, onExploreMarketplace }: HeroSectionProps) => {
  const capabilities = [
    {
      icon: Wallet,
      title: 'Wallet connectivity',
      description: 'Connect an XRPL account through Xaman. The app never holds or transmits your seed.',
      status: 'Working',
    },
    {
      icon: FileSignature,
      title: 'Transaction construction',
      description: 'Server-side builders assemble XRPL transactions for you to review and sign in Xaman.',
      status: 'Testnet ready',
    },
    {
      icon: ListChecks,
      title: 'Listings and campaigns',
      description: 'Business profiles can post standard property listings and run community funding campaigns.',
      status: 'Working',
    },
    {
      icon: FlaskConical,
      title: 'Real-world-asset issuance',
      description: 'Defining an MPT issuance on XRPL. Holder authorization and distribution are not built yet.',
      status: 'Experimental',
    },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-[60vw] max-w-96 h-[60vw] max-h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 right-1/4 w-[60vw] max-w-96 h-[60vw] max-h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <PrototypeNotice className="mb-10 max-w-3xl mx-auto">
          Built for the XRP MakeWaves hackathon. Everything below describes what the code does today, including the
          parts that are simulated, disabled, or still planned.
        </PrototypeNotice>

        <div className="text-center mb-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <Badge variant="secondary" className="mb-2">Hackathon prototype</Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 animate-fade-in">
                <span className="text-foreground">A working prototype for</span>
                <br />
                <span className="bg-gradient-hero bg-clip-text text-transparent">
                  community real estate on XRPL
                </span>
              </h1>
              <p className="text-lg text-muted-foreground font-medium animate-fade-in" style={{ animationDelay: '0.1s' }}>
                Listings, community funding workflows, and XRPL transaction building with non-custodial signing.
              </p>
            </div>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Accountabul is an early build exploring how property listings, community funding, and real-world-asset
              issuance could work on the XRP Ledger. Public flows default to XRPL Testnet, trading surfaces are
              disabled, and every signature happens in your own wallet.
            </p>
          </div>
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="premium"
                size="lg"
                onClick={onGetStarted}
                className="text-lg px-8 py-4 h-auto"
              >
                Create an account
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-4 h-auto"
                onClick={onExploreMarketplace}
              >
                Browse listings
              </Button>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Are you a service provider or business?</p>
                  <p className="text-sm text-muted-foreground">Create a business profile and post a listing on Accountabul.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link to="/auth/business">
                  Join the vendor network
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-16 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="relative rounded-2xl overflow-hidden shadow-elegant hover:shadow-glow transition-all duration-500">
            <img
              src={heroImage}
              alt="Accountabul prototype interface for property listings on the XRP Ledger"
              className="w-full h-[400px] md:h-[500px] object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <Card key={index} className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-card transition-all duration-300 animate-fade-in" style={{ animationDelay: `${0.8 + index * 0.1}s` }}>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{capability.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{capability.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{capability.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
