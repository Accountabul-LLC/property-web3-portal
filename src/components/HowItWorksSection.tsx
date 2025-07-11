import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, Shield } from 'lucide-react';

const HowItWorksSection = () => {
  const pillars = [
    {
      icon: Building2,
      title: "Tokenize Your Property",
      description: "Convert real estate into blockchain tokens for fractional ownership and transparent trading.",
      link: "Learn More"
    },
    {
      icon: TrendingUp,
      title: "Invest Fractionally", 
      description: "Buy and sell property tokens, build diversified real estate portfolios with any budget.",
      link: "Learn More"
    },
    {
      icon: Shield,
      title: "Track & Trade",
      description: "Monitor your investments, track yields, and trade tokens seamlessly on our platform.",
      link: "Learn More"
    },
    {
      icon: Users,
      title: "Professional Services",
      description: "Connect with verified appraisers, notaries, and property managers through our marketplace.",
      link: "Learn More"
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Get Membership & Connect Wallet",
      description: "Purchase Accountabul Membership and connect your XRPL wallet to unlock platform features."
    },
    {
      number: "2", 
      title: "Tokenize or Explore Marketplace",
      description: "List your property for tokenization or browse available real estate investment opportunities."
    },
    {
      number: "3",
      title: "Invest, Track, and Grow",
      description: "Build your portfolio, earn yields from rental income, and trade tokens to optimize returns."
    }
  ];

  return (
    <div className="py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* How It Works Pillars */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              How Accountabul Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Four core pillars that make real estate investment accessible, transparent, and secure for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <Card key={index} className="group hover:shadow-glow transition-all duration-300 hover:scale-105 bg-card/50 backdrop-blur-sm border border-border/50">
                  <CardHeader className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl font-semibold">
                      {pillar.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      {pillar.description}
                    </p>
                    <button className="text-primary hover:text-primary/80 font-medium transition-colors">
                      {pillar.link} →
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="bg-muted/30 backdrop-blur-sm border border-muted rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Note:</strong> Accountabul Membership unlocks all platform features.
            </p>
          </div>
        </div>

        {/* Getting Started Steps */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              How to Get Started
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Three simple steps to begin your real estate tokenization journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="space-y-4 group cursor-pointer">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-primary-foreground group-hover:scale-110 transition-transform duration-300">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksSection;