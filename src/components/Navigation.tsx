import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, TrendingUp, Users, Menu, X, Bot, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import WalletSelector from '@/components/WalletSelector';
import { useAuth } from '@/hooks/useAuth';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const {
    isConnected,
    isConnectModalOpen,
    openConnectModal,
    closeConnectModal,
    onWalletConnected,
  } = useActiveWallet();

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const navItems = [
    { path: '/marketplace', label: 'Real Estate Marketplace', icon: Building2 },
    { path: '/tokenize', label: 'Tokenize Property', icon: TrendingUp },
    { path: '/professionals', label: 'Professional Marketplace', icon: Users },
    { path: '/ai-agents', label: 'AI Agent Marketplace', icon: Bot },
    { path: '/portfolio', label: 'Portfolio', icon: Wallet },
  ];

  const currentPath = location.pathname;

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-card h-[72px]">
      <div className="max-w-7xl mx-auto px-10 h-full">
        <div className="flex items-center justify-between h-full overflow-hidden">
          {/* Mobile menu button + Logo & Brand */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden text-muted-foreground hover:text-foreground transition-colors mr-3"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity mr-10"
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
          </div>

          {/* Desktop Navigation — centered */}
          <div className="hidden xl:flex items-center justify-center flex-1 min-w-0">
            <div className="flex items-center gap-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center space-x-1.5 px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                      currentPath === item.path
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

          {/* Desktop Action Buttons */}
          <div className="hidden xl:flex items-center space-x-3 flex-shrink-0">
            <ThemeToggle />
            {isConnected ? (
              <WalletSelector />
            ) : (
              <Button 
                variant="outline" 
                onClick={openConnectModal}
                className="h-10 px-6 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            )}
            {user ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="h-10 px-4 font-medium"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  onClick={signOut}
                  className="h-10 px-4 font-medium text-muted-foreground"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                variant="hero"
                onClick={() => navigate('/auth')}
                className="h-10 px-6 font-medium"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile wallet info */}
          <div className="xl:hidden flex items-center space-x-2 flex-shrink-0">
            <ThemeToggle />
            {isConnected ? (
              <WalletSelector compact />
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={openConnectModal}
                className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop overlay — covers entire screen behind menu */}
      {isMobileMenuOpen && (
        <div
          className="xl:hidden fixed inset-0 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div
          className="xl:hidden border-t border-border bg-card/95 backdrop-blur-md absolute left-0 right-0 top-[72px] z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                    currentPath === item.path
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
              {!isConnected && (
                <Button 
                  variant="outline" 
                  onClick={openConnectModal}
                  className="w-full h-10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
              {user ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { navigate('/dashboard'); setIsMobileMenuOpen(false); }}
                    className="w-full h-10 font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={signOut}
                    className="w-full h-10 font-medium text-muted-foreground"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  variant="hero"
                  onClick={() => { navigate('/auth'); setIsMobileMenuOpen(false); }}
                  className="w-full h-10 font-medium"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wallet Connect Modal */}
      <WalletConnectModal 
        isOpen={isConnectModalOpen}
        onClose={closeConnectModal}
        onWalletConnected={onWalletConnected}
      />
    </nav>
  );
};

export default Navigation;
