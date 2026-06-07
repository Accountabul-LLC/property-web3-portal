import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Briefcase, Shield, TrendingUp, Users, Zap } from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';

interface HeroSectionProps {
  onGetStarted: () => void;
  onExploreMarketplace: () => void;
}

const HeroSection = ({ onGetStarted, onExploreMarketplace }: HeroSectionProps) => {
  const features = [
    {
      icon: Shield,
      title: 'Secure & Verified',
      description: 'DID-based verification and smart contract protection'
    },
    {
      icon: TrendingUp,
      title: 'Fractional Ownership',
      description: 'Own portions of premium real estate starting from $100'
    },
    {
      icon: Users,
      title: 'Professional Network',
      description: 'Connect with verified appraisers, notaries, and managers'
    },
    {
      icon: Zap,
      title: 'Instant Liquidity',
      description: 'Trade property tokens 24/7 on our integrated exchange'
    }
  ];

  const stats = [
    { value: '$50M+', label: 'Properties Tokenized' },
    { value: '12,000+', label: 'Active Members' },
    { value: '25,000+', label: 'Transactions' },
    { value: '8.5%', label: 'Average Return' }
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-[60vw] max-w-96 h-[60vw] max-h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 right-1/4 w-[60vw] max-w-96 h-[60vw] max-h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 animate-fade-in">
                <span className="text-foreground">Own Your Future.</span>
                <br />
                <span className="bg-gradient-hero bg-clip-text text-transparent">
                  Tokenize Real Estate
                </span>
                <br />
                <span className="text-foreground">with Accountabul.</span>
              </h1>
              <p className="text-lg text-muted-foreground font-medium animate-fade-in" style={{ animationDelay: '0.1s' }}>
                Empowering Ownership. Elevating Community. Built on Blockchain.
              </p>
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Fractional ownership. Secure transactions. Community-powered wealth.
              <br />
              Tokenize, invest, and manage real estate portfolios—all powered by secure,
              transparent blockchain technology, and built for everyone.
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
                Start Tokenizing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-4 h-auto"
                onClick={onExploreMarketplace}
              >
                Explore Marketplace
              </Button>
            </div>

            <div className="bg-muted/30 backdrop-blur-sm border border-muted rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground text-center">
                <strong>Membership Required:</strong> All tokenization and marketplace features require active Accountabul Membership.
              </p>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Are you a service provider or business?</p>
                  <p className="text-sm text-muted-foreground">List your services to real estate investors on Accountabul.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link to="/auth/vendor">
                  Join the Vendor Network
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
              alt="Real Estate Tokenization Platform"
              className="w-full h-[400px] md:h-[500px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-card transition-all duration-300 animate-fade-in" style={{ animationDelay: `${0.8 + index * 0.1}s` }}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="animate-fade-in" style={{ animationDelay: `${1.2 + index * 0.1}s` }}>
              <div className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
