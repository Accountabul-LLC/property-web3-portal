import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, TrendingUp, Users, Menu, X, Bot, LogIn, LogOut, LayoutDashboard, Coins, ShieldAlert, ClipboardList, ShieldCheck, ArrowLeftRight, Landmark, Droplets, Heart, ReceiptText, Tag, Lock } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

import { WalletConnectModal } from '@/components/WalletConnectModal';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import WalletSelector from '@/components/WalletSelector';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { useKycStatus } from '@/hooks/useKycStatus';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { isLockedProductPath } from '@/config/productAccess';

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

  const { data: isAdminOrCompliance } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (isAdmin) return true;
      const { data: isCompliance } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' });
      return !!isCompliance;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  // shortLabel used between lg (1024px) and xl (1280px) to prevent overflow
  const navItems = [
    { path: '/causes',       label: 'Causes',       shortLabel: 'Causes',  icon: Heart },
    ...(user ? [{ path: '/causes/my-donations', label: 'My Donations', shortLabel: 'Donations', icon: Coins }] : []),
    { path: '/escrow', label: 'Escrow', shortLabel: 'Escrow', icon: Lock },
    { path: '/payments', label: 'Payments', shortLabel: 'Pay', icon: ReceiptText },
    { path: '/marketplace',  label: 'Marketplace',  shortLabel: 'Market',  icon: Building2 },
    { path: '/tokenize',     label: 'Tokenize',     icon: TrendingUp },
    { path: '/professionals', label: 'Professionals', shortLabel: 'Pros',  icon: Users },
    { path: '/ai-agents',   label: 'AI Agents',    shortLabel: 'Agents',  icon: Bot },
    { path: '/swap',         label: 'Swap',          icon: ArrowLeftRight },
    { path: '/pools',        label: 'Liquidity',     shortLabel: 'Pools',  icon: Droplets },
    { path: '/portfolio',    label: 'Portfolio',     icon: Wallet },
    { path: '/treasury',     label: 'Treasury',      icon: Landmark },
    { path: '/pricing',      label: 'Pricing',       icon: Tag },
  ];


  const currentPath = location.pathname;

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-card h-[72px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full gap-2">

          {/* Left: hamburger (< lg) + logo */}
          <div className="flex items-center flex-shrink-0 mr-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="block text-muted-foreground hover:text-foreground transition-colors mr-3"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <img
                src="/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png"
                alt="Accountabul Logo"
                className="w-8 h-8"
              />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent whitespace-nowrap">
                Accountabul
              </span>
            </button>
          </div>

          {/* Center: desktop nav (lg+) */}
          <div className="hidden items-center justify-center flex-1 min-w-0 mx-2">
            <div className="flex items-center gap-0.5 xl:gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      if (isLockedProductPath(item.path)) return;
                      navigate(item.path);
                    }}
                    disabled={isLockedProductPath(item.path)}
                    title={isLockedProductPath(item.path) ? `${item.label} is locked for now` : undefined}
                    className={`flex items-center gap-1.5 px-2 xl:px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-md transition-all duration-300 ${
                      isActive
                        ? 'text-primary bg-primary/5'
                        : isLockedProductPath(item.path)
                          ? 'text-muted-foreground/60 bg-muted/20 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {isLockedProductPath(item.path) && <Lock className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />}
                    {/* lg–xl: short label; xl+: full label */}
                    <span className="lg:inline xl:hidden">{item.shortLabel ?? item.label}</span>
                    <span className="hidden xl:inline">{item.label}</span>
                    {isLockedProductPath(item.path) && (
                      <span className="ml-1 inline-flex items-center rounded-full border border-border/70 bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: desktop actions (lg+) */}
          <div className="hidden items-center gap-1.5 xl:gap-2 flex-shrink-0">
            <ThemeToggle />
            {user && isConnected && <NotificationBell />}
            {user && !kycApproved && (
              <button
                onClick={() => navigate('/kyc')}
                className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors whitespace-nowrap"
                title="Complete identity verification"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="hidden xl:inline">Verify Identity</span>
              </button>
            )}
            {user && isAdminOrCompliance && (
              <button
                onClick={() => navigate('/admin')}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded-md transition-all duration-300 ${
                  currentPath.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Admin</span>
              </button>
            )}
            {user && (
              isConnected ? (
                <WalletSelector />
              ) : (
                <Button
                  variant="outline"
                  onClick={openConnectModal}
                  className="h-9 px-2 xl:px-5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium text-sm"
                >
                  <Wallet className="w-4 h-4 xl:mr-2" />
                  <span className="hidden xl:inline">Connect Wallet</span>
                </Button>
              )
            )}
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                  className="h-9 w-9 font-medium"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={signOut}
                  className="h-9 px-2 xl:px-4 font-medium text-muted-foreground"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4 xl:mr-2" />
                  <span className="hidden xl:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <Button
                variant="hero"
                onClick={() => navigate('/auth')}
                className="h-9 px-3 xl:px-6 font-medium text-sm"
              >
                <LogIn className="w-4 h-4 xl:mr-2" />
                <span className="hidden xl:inline">Sign In</span>
              </Button>
            )}
          </div>

          {/* Mobile/tablet strip actions (< lg): theme + wallet/sign-in only */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            {user && isConnected && <NotificationBell />}
            {user ? (
              isConnected ? (
                <WalletSelector compact />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openConnectModal}
                  className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Wallet className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Connect</span>
                </Button>
              )
            ) : (
              <Button
                variant="hero"
                size="sm"
                onClick={() => navigate('/auth')}
                className="h-8 px-3 text-xs font-medium"
              >
                <LogIn className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
          </div>

        </div>
      </div>

      {/* Mobile/tablet drawer (< lg) — rendered via portal to escape nav overflow */}
      {isMobileMenuOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className="fixed left-0 right-0 top-[72px] z-50 border-t border-border bg-card/95 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 max-h-[calc(100vh-72px)] overflow-y-auto overflow-x-hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      if (isLockedProductPath(item.path)) return;
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isLockedProductPath(item.path)}
                    title={isLockedProductPath(item.path) ? `${item.label} is locked for now` : undefined}
                    className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      currentPath === item.path
                        ? 'bg-primary text-primary-foreground'
                        : isLockedProductPath(item.path)
                          ? 'text-muted-foreground/60 bg-muted/20 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {isLockedProductPath(item.path) && <Lock className="w-3.5 h-3.5 opacity-80" />}
                    <span>{item.label}</span>
                    {isLockedProductPath(item.path) && (
                      <span className="ml-auto inline-flex items-center rounded-full border border-border/70 bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    )}
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
              <div className="pt-2 border-t border-border space-y-2">
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

      <WalletConnectModal
        isOpen={isConnectModalOpen}
        onClose={closeConnectModal}
        onWalletConnected={onWalletConnected}
      />
    </nav>
  );
};

export default Navigation;
