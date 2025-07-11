import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Shield, TrendingUp, Users, Zap } from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
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
    { value: '$2.4B+', label: 'Total Value Locked' },
    { value: '12,500+', label: 'Properties Tokenized' },
    { value: '95%+', label: 'User Satisfaction' },
    { value: '24/7', label: 'Trading Available' }
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-hero opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent animate-fade-in">
            Tokenize Real Estate,
            <br />
            <span className="text-3xl md:text-5xl lg:text-6xl">Unlock Liquidity</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            The first Web3 platform enabling fractional real estate ownership through blockchain tokenization. 
            Trade, stake, and earn from property investments with complete transparency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Button 
              variant="premium" 
              size="lg" 
              onClick={onGetStarted}
              className="text-lg px-8 py-4 h-auto"
            >
              Start Tokenizing
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto">
              View Properties
            </Button>
          </div>
        </div>

        {/* Hero Image */}
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

        {/* Features Grid */}
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

        {/* Stats */}
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