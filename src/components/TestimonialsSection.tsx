import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Property Owner",
      avatar: "SJ",
      quote: "Accountabul made tokenizing my rental property incredibly simple. I was able to unlock liquidity while still maintaining ownership control.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Investor",
      avatar: "MC", 
      quote: "Finally, a platform that makes real estate investment accessible. I started with just $500 and now have a diversified portfolio.",
      rating: 5
    },
    {
      name: "Lisa Rodriguez",
      role: "Real Estate Professional",
      avatar: "LR",
      quote: "The professional marketplace connected me with quality clients. The escrow system gives everyone peace of mind.",
      rating: 5
    }
  ];

  const stats = [
    { label: "Properties Tokenized", value: "$50M+" },
    { label: "Active Members", value: "12,000+" },
    { label: "Transactions", value: "25,000+" },
    { label: "Average Return", value: "8.5%" }
  ];

  return (
    <div className="py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              What Our Members Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Real stories from property owners, investors, and professionals who are 
              building wealth with Accountabul.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="group hover:shadow-glow transition-all duration-300 bg-card/50 backdrop-blur-sm border border-border/50">
                <CardContent className="p-6 space-y-4">
                  {/* Rating */}
                  <div className="flex justify-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="text-muted-foreground italic leading-relaxed">
                    "{testimonial.quote}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center space-x-3 justify-center">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground font-medium">
                        {testimonial.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="font-semibold text-sm">
                        {testimonial.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialsSection;