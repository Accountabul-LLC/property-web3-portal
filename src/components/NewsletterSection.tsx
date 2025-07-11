import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Twitter, Github, Linkedin } from 'lucide-react';

const NewsletterSection = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter signup
    console.log('Newsletter signup:', email);
    setEmail('');
  };

  const socialLinks = [
    { icon: Twitter, label: "Twitter", href: "#" },
    { icon: Github, label: "GitHub", href: "#" },
    { icon: Linkedin, label: "LinkedIn", href: "#" },
  ];

  return (
    <div className="py-24 px-4 bg-muted/20">
      <div className="max-w-4xl mx-auto text-center space-y-12">
        {/* Newsletter Signup */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              Stay Connected
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get the latest updates on new properties, platform features, 
              and real estate tokenization insights.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" variant="hero" size="lg">
              Subscribe
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            No spam, unsubscribe at any time. We respect your privacy.
          </p>
        </div>

        {/* Social Links */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">
            Join Our Community
          </h3>
          <div className="flex justify-center space-x-6">
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              return (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-12 h-12 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-muted hover:scale-110 transition-all duration-300"
                >
                  <Icon className="w-5 h-5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterSection;