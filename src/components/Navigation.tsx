import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, TrendingUp, Users, Menu, X, Bot, LogIn, LogOut, LayoutDashboard, Coins, ShieldAlert, ClipboardList } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import WalletSelector from '@/components/WalletSelector';
import { useAuth } from '@/hooks/useAuth';
import { useKycStatus } from '@/hooks/useKycStatus';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
  const { isApproved: kycApproved } = useKycStatus();

  // Check if user has admin or compliance_officer role
  const { data: isAdminOrCompliance } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (isAdmin) return true;
      const { data: isCompliance } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' as any });
      return !!isCompliance;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const navItems = [
    { path: '/marketplace', label: 'Marketplace', icon: Building2 },
    { path: '/tokenize', label: 'Tokenize', icon: TrendingUp },
    { path: '/professionals', label: 'Professionals', icon: Users },
    { path: '/ai-agents', label: 'AI Agents', icon: Bot },
    { path: '/mint', label: 'Mint', icon: Coins },
    { path: '/portfolio', label: 'Portfolio', icon: Wallet },
  ];

  const currentPath = location.pathname;

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-card h-[72px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-full">
        <div className="flex items-center justify-between h-full">
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
          <div className="hidden xl:flex items-center justify-center flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium whitespace-nowrap rounded-md transition-all duration-300 ${
                      currentPath === item.path
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden xl:flex items-center space-x-3 flex-shrink-0">
            <ThemeToggle />
            {user && !kycApproved && (
              <button
                onClick={() => navigate('/kyc')}
                className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                title="Complete identity verification"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                Verify Identity
              </button>
            )}
            {user && isAdminOrCompliance && (
              <button
                onClick={() => navigate('/admin')}
                className={`flex items-center space-x-1.5 px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  currentPath.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
            {user && (
              isConnected ? (
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
              )
            )}
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                  className="h-10 w-10 font-medium"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
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

          {/* Mobile header actions */}
          <div className="xl:hidden flex items-center space-x-2 flex-shrink-0">
            <ThemeToggle />
            {user && (
              isConnected ? (
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
              )
            )}
            {user ? (
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="h-8 px-3 text-xs font-medium"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="h-8 w-8 p-0 text-muted-foreground"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="hero"
                size="sm"
                onClick={() => navigate('/auth')}
                className="h-8 px-3 text-xs font-medium"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop + Mobile Menu rendered via portal so they escape nav overflow */}
      {isMobileMenuOpen && createPortal(
        <>
          <div
            className="xl:hidden fixed inset-0 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className="xl:hidden fixed left-0 right-0 top-[72px] z-50 border-t border-border bg-card/95 backdrop-blur-md"
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
            {user && !kycApproved && (
              <button
                onClick={() => { navigate('/kyc'); setIsMobileMenuOpen(false); }}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Verify Identity</span>
              </button>
            )}
            {user && isAdminOrCompliance && (
              <button
                onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  currentPath.startsWith('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
            <div className="pt-2 space-y-2">
              {user && !isConnected && (
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
        </>,
        document.body
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
