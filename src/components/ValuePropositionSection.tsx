import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, Globe, Users, Zap } from 'lucide-react';

const ValuePropositionSection = () => {
  const values = [
    {
      icon: Shield,
      title: "Blockchain-Powered",
      description: "Built on XRPL for maximum security and transparency"
    },
    {
      icon: Zap,
      title: "Transparent & Secure", 
      description: "All transactions and ownership records on-chain"
    },
    {
      icon: Users,
      title: "For All Communities",
      description: "Accessible real estate investment for everyone"
    },
    {
      icon: Globe,
      title: "Real World Assets",
      description: "Tokenized properties with verified ownership"
    }
  ];

  const badges = [
    "SEC Compliant",
    "XRPL Verified", 
    "Insurance Protected",
    "Audit Certified",
    "Community Governed"
  ];

  return (
    <div className="py-24 px-4 bg-muted/20">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Value Proposition */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              Why Choose Accountabul?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We're revolutionizing real estate investment with cutting-edge blockchain technology 
              and community-first principles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div key={index} className="space-y-4 group">
                  <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="text-center space-y-8">
          <h3 className="text-2xl font-semibold">
            Trusted & Verified
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {badges.map((badge, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="px-4 py-2 text-sm font-medium bg-background/80 hover:bg-background border border-border/50"
              >
                {badge}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValuePropositionSection;