import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, TrendingUp, Users, Menu, X } from 'lucide-react';

interface NavigationProps {
  onSectionChange: (section: string) => void;
  currentSection: string;
}

const Navigation = ({ onSectionChange, currentSection }: NavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'marketplace', label: 'Real Estate Marketplace', icon: Building2 },
    { id: 'tokenize', label: 'Tokenize Property', icon: TrendingUp },
    { id: 'professionals', label: 'Professional Marketplace', icon: Users },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  ];

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-card h-[72px]">
      <div className="max-w-7xl mx-auto px-10 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo & Brand */}
          <button 
            onClick={() => onSectionChange('home')}
            className="flex-shrink-0 flex items-center space-x-2 hover:opacity-80 transition-opacity mr-10"
          >
            <img 
              src="/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png" 
              alt="Accountabul Logo" 
              className="w-8 h-8"
            />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Accountabul
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`flex items-center space-x-2 px-2 py-1 text-sm font-medium transition-all duration-300 ${
                    currentSection === item.id
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="outline" className="h-10 px-6 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium">
              Connect Wallet
            </Button>
            <Button variant="hero" className="h-10 px-6 font-medium">
              Help / AI Assistant
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSectionChange(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                    currentSection === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="pt-2 space-y-2">
              <Button variant="outline" className="w-full h-10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium">
                Connect Wallet
              </Button>
              <Button variant="hero" className="w-full h-10 font-medium">
                Help / AI Assistant
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;