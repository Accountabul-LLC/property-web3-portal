import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, TrendingUp, Users, Menu, X, Bot } from 'lucide-react';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { useWalletAuth } from '@/hooks/useWalletAuth';

interface NavigationProps {
  onSectionChange: (section: string) => void;
  currentSection: string;
}

const Navigation = ({ onSectionChange, currentSection }: NavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { isConnected, walletAddress, connect, disconnect, isModalOpen, setModalOpen, onWalletConnected } = useWalletAuth();

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navItems = [
    { id: 'marketplace', label: 'Real Estate Marketplace', icon: Building2 },
    { id: 'tokenize', label: 'Tokenize Property', icon: TrendingUp },
    { id: 'professionals', label: 'Professional Marketplace', icon: Users },
    { id: 'ai-agents', label: 'AI Agent Marketplace', icon: Bot },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  ];

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-card h-[72px]">
      <div className="max-w-7xl mx-auto px-10 h-full">
        <div className="flex items-center justify-between h-full overflow-hidden">
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

          {/* Desktop Navigation — centered */}
          <div className="hidden xl:flex items-center justify-center flex-1 min-w-0">
            <div className="flex items-center gap-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`flex items-center space-x-1.5 px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                      currentSection === item.id
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="hidden xl:flex items-center space-x-3 flex-shrink-0">
            {isConnected && walletAddress ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {formatWalletAddress(walletAddress)}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={disconnect}
                  className="h-9 px-4 text-sm"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={connect}
                className="h-10 px-6 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            )}
            <Button variant="hero" className="h-10 px-6 font-medium">
              Help / AI Assistant
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden">
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
        <div className="xl:hidden border-t border-border bg-card/95 backdrop-blur-md">
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
              {isConnected && walletAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {formatWalletAddress(walletAddress)}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={disconnect}
                    className="w-full h-10 text-sm"
                  >
                    Disconnect Wallet
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={connect}
                  className="w-full h-10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
              <Button variant="hero" className="w-full h-10 font-medium">
                Help / AI Assistant
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Connect Modal */}
      <WalletConnectModal 
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onWalletConnected={onWalletConnected}
      />
    </nav>
  );
};

export default Navigation;