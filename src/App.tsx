import { Suspense, lazy, type ComponentType } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ActiveWalletProvider } from "@/contexts/ActiveWalletContext";
import { ThemeProvider } from "next-themes";
import KycGate from "./components/KycGate";

import { AdminOrLocked } from "./components/AdminOrLocked";
import { RouteGuard } from "./components/RouteGuard";
import { RouteSeo } from "./components/RouteSeo";
import { WalletActivityWatcher } from "./components/WalletActivityWatcher";

const queryClient = new QueryClient();

const lazyPage = <T extends Record<string, unknown>>(loader: () => Promise<{ default: ComponentType<T> }>) =>
  lazy(loader);

const Index = lazyPage(() => import("./pages/Index"));
const Marketplace = lazyPage(() => import("./pages/Marketplace"));
const Auth = lazyPage(() => import("./pages/Auth"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Professionals = lazyPage(() => import("./pages/Professionals"));
const AIAgents = lazyPage(() => import("./pages/AIAgents"));
const Portfolio = lazyPage(() => import("./pages/Portfolio"));
const PropertyDetail = lazyPage(() => import("./pages/PropertyDetail"));
const Mint = lazyPage(() => import("./pages/Mint"));
const Kyc = lazyPage(() => import("./pages/Kyc"));
const KycStatus = lazyPage(() => import("./pages/KycStatus"));
const AdminKyc = lazyPage(() => import("./pages/AdminKyc"));
const Admin = lazyPage(() => import("./pages/Admin"));
const AdminAIPanel = lazyPage(() => import("./pages/AdminAIPanel"));
const AdminCredentials = lazyPage(() => import("./pages/AdminCredentials"));
const AdminVendors = lazyPage(() => import("./pages/AdminVendors"));
const AdminPayments = lazyPage(() => import("./pages/AdminPayments"));
const AdminPaymentsConsole = lazyPage(() => import("./pages/AdminPaymentsConsole"));
const AdminUsers = lazyPage(() => import("./pages/AdminUsers"));
const ActionItems = lazyPage(() => import("./pages/ActionItems"));
const Credentials = lazyPage(() => import("./pages/Credentials"));
const AdminCauses = lazyPage(() => import("./pages/AdminCauses"));
const AdminPricing = lazyPage(() => import("./pages/AdminPricing"));
const Causes = lazyPage(() => import("./pages/Causes"));
const CauseDetail = lazyPage(() => import("./pages/CauseDetail"));
const CauseApply = lazyPage(() => import("./pages/CauseApply"));
const MyDonations = lazyPage(() => import("./pages/MyDonations"));
const Settings = lazyPage(() => import("./pages/Settings"));
const DeedProtection = lazyPage(() => import("./pages/DeedProtection"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const Tokenize = lazyPage(() => import("./pages/Tokenize"));
const Payments = lazyPage(() => import("./pages/Payments"));
const PaymentsHistory = lazyPage(() => import("./pages/PaymentsHistory"));
const PaymentDetail = lazyPage(() => import("./pages/PaymentDetail"));
const Swap = lazyPage(() => import("./pages/Swap"));
const Pools = lazyPage(() => import("./pages/Pools"));
const Treasury = lazyPage(() => import("./pages/Treasury"));
const Escrow = lazyPage(() => import("./pages/Escrow"));
const SmartEscrow = lazyPage(() => import("./pages/SmartEscrow"));
const Pricing = lazyPage(() => import("./pages/Pricing"));



function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ActiveWalletProvider>
        <TooltipProvider>
          <Sonner />
          <WalletActivityWatcher />
          <BrowserRouter>
            <RouteSeo />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/tokenize" element={<AdminOrLocked><Tokenize /></AdminOrLocked>} />
                <Route path="/professionals" element={<Professionals />} />
                <Route path="/ai-agents" element={<RouteGuard adminOnly><AIAgents /></RouteGuard>} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/payments/history" element={<PaymentsHistory />} />
                <Route path="/payments/:id" element={<PaymentDetail />} />
                <Route path="/swap" element={<AdminOrLocked><Swap /></AdminOrLocked>} />
                <Route path="/pools" element={<AdminOrLocked><Pools /></AdminOrLocked>} />
                <Route path="/treasury" element={<AdminOrLocked><Treasury /></AdminOrLocked>} />
                <Route path="/smart-escrow" element={<AdminOrLocked><SmartEscrow /></AdminOrLocked>} />
                <Route path="/escrow" element={<Escrow />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/mint" element={<RouteGuard adminOnly><KycGate><Mint /></KycGate></RouteGuard>} />

                <Route path="/kyc" element={<Kyc />} />
                <Route path="/kyc/status" element={<KycStatus />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/kyc" element={<AdminKyc />} />
                <Route path="/admin/ai-panel" element={<AdminAIPanel />} />
                <Route path="/admin/credentials" element={<AdminCredentials />} />
                <Route path="/admin/vendors" element={<AdminVendors />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
                <Route path="/admin/payments/console" element={<AdminPaymentsConsole />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/causes" element={<AdminCauses />} />
                <Route path="/admin/pricing" element={<AdminPricing />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/action-items" element={<ActionItems />} />
                <Route path="/credentials" element={<Credentials />} />
                <Route path="/causes" element={<Causes />} />
                <Route path="/causes/apply" element={<CauseApply />} />
                <Route path="/causes/my-donations" element={<MyDonations />} />
                <Route path="/causes/:slug" element={<CauseDetail />} />
                <Route path="/protection/deed-fraud" element={<DeedProtection />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ActiveWalletProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
