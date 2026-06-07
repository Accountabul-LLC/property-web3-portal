import { Suspense, lazy, type ComponentType } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ActiveWalletProvider } from "@/contexts/ActiveWalletContext";
import { ThemeProvider } from "next-themes";
import KycGate from "./components/KycGate";
import { RouteGuard } from "./components/RouteGuard";
import { RouteSeo } from "./components/RouteSeo";
import { WalletActivityWatcher } from "./components/WalletActivityWatcher";

const queryClient = new QueryClient();

const lazyPage = <T extends Record<string, unknown>>(loader: () => Promise<{ default: ComponentType<T> }>) =>
  lazy(loader);

const Index = lazyPage(() => import("./pages/Index"));
const Marketplace = lazyPage(() => import("./pages/Marketplace"));
const Tokenize = lazyPage(() => import("./pages/Tokenize"));
const Auth = lazyPage(() => import("./pages/Auth"));
const AuthIndividual = lazyPage(() => import("./pages/AuthIndividual"));
const AuthBusiness = lazyPage(() => import("./pages/AuthBusiness"));
const AuthVendor = lazyPage(() => import("./pages/AuthVendor"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Professionals = lazyPage(() => import("./pages/Professionals"));
const AIAgents = lazyPage(() => import("./pages/AIAgents"));
const Portfolio = lazyPage(() => import("./pages/Portfolio"));
const PropertyDetail = lazyPage(() => import("./pages/PropertyDetail"));
const Mint = lazyPage(() => import("./pages/Mint"));
const Swap = lazyPage(() => import("./pages/Swap"));
const Pools = lazyPage(() => import("./pages/Pools"));
const Treasury = lazyPage(() => import("./pages/Treasury"));
const Kyc = lazyPage(() => import("./pages/Kyc"));
const KycStatus = lazyPage(() => import("./pages/KycStatus"));
const AdminKyc = lazyPage(() => import("./pages/AdminKyc"));
const Admin = lazyPage(() => import("./pages/Admin"));
const AdminVendors = lazyPage(() => import("./pages/AdminVendors"));
const AdminAIPanel = lazyPage(() => import("./pages/AdminAIPanel"));
const AdminCredentials = lazyPage(() => import("./pages/AdminCredentials"));
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
const Payments = lazyPage(() => import("./pages/Payments"));
const Settings = lazyPage(() => import("./pages/Settings"));
const PaymentsHistory = lazyPage(() => import("./pages/PaymentsHistory"));
const PaymentDetail = lazyPage(() => import("./pages/PaymentDetail"));
const Pricing = lazyPage(() => import("./pages/Pricing"));
const CheckoutReturn = lazyPage(() => import("./pages/CheckoutReturn"));
const AccountBilling = lazyPage(() => import("./pages/AccountBilling"));
const Escrow = lazyPage(() => import("./pages/Escrow"));
const SmartEscrow = lazyPage(() => import("./pages/SmartEscrow"));
const DeedProtection = lazyPage(() => import("./pages/DeedProtection"));
const VendorOnboarding = lazyPage(() => import("./pages/VendorOnboarding"));
const VendorDashboard = lazyPage(() => import("./pages/VendorDashboard"));
const VendorsDirectory = lazyPage(() => import("./pages/VendorsDirectory"));
const VendorPublicProfile = lazyPage(() => import("./pages/VendorPublicProfile"));
const VendorJoin = lazyPage(() => import("./pages/VendorJoin"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

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
                <Route path="/auth/individual" element={<AuthIndividual />} />
                <Route path="/auth/business" element={<AuthBusiness />} />
                <Route path="/auth/vendor" element={<AuthVendor />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/tokenize" element={<RouteGuard adminOnly><KycGate><Tokenize /></KycGate></RouteGuard>} />
                <Route path="/professionals" element={<Professionals />} />
                <Route path="/ai-agents" element={<RouteGuard adminOnly><AIAgents /></RouteGuard>} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/payments/history" element={<RouteGuard><KycGate><PaymentsHistory /></KycGate></RouteGuard>} />
                <Route path="/payments/:id" element={<RouteGuard><KycGate><PaymentDetail /></KycGate></RouteGuard>} />
                <Route path="/swap" element={<RouteGuard adminOnly><Swap /></RouteGuard>} />
                <Route path="/pools" element={<RouteGuard adminOnly><Pools /></RouteGuard>} />
                <Route path="/treasury" element={<Treasury />} />
                <Route path="/smart-escrow" element={<RouteGuard adminOnly><SmartEscrow /></RouteGuard>} />
                <Route path="/escrow" element={<Escrow />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/mint" element={<RouteGuard adminOnly><KycGate><Mint /></KycGate></RouteGuard>} />

                <Route path="/kyc" element={<Kyc />} />
                <Route path="/kyc/status" element={<KycStatus />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/vendors" element={<AdminVendors />} />
                <Route path="/admin/kyc" element={<AdminKyc />} />
                <Route path="/admin/ai-panel" element={<AdminAIPanel />} />
                <Route path="/admin/credentials" element={<AdminCredentials />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
                <Route path="/admin/payments/console" element={<AdminPaymentsConsole />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/causes" element={<AdminCauses />} />
                <Route path="/admin/pricing" element={<AdminPricing />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/checkout/return" element={<CheckoutReturn />} />
                <Route path="/account/billing" element={<AccountBilling />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/action-items" element={<ActionItems />} />
                <Route path="/credentials" element={<Credentials />} />
                <Route path="/causes" element={<Causes />} />
                <Route path="/causes/apply" element={<CauseApply />} />
                <Route path="/causes/my-donations" element={<MyDonations />} />
                <Route path="/causes/:slug" element={<CauseDetail />} />
                <Route path="/protection/deed-fraud" element={<DeedProtection />} />
                <Route path="/vendor/onboarding" element={<VendorOnboarding />} />
                <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                <Route path="/vendors" element={<VendorsDirectory />} />
                <Route path="/vendors/join" element={<VendorJoin />} />
                <Route path="/vendor/:slug" element={<VendorPublicProfile />} />
                {/* Legacy redirects */}
                <Route path="/vendor" element={<Navigate to="/vendors" replace />} />
                <Route path="/vendor/status" element={<Navigate to="/vendor/dashboard" replace />} />
                <Route path="/vendors/apply" element={<Navigate to="/auth/vendor" replace />} />
                <Route path="/vendors/status" element={<Navigate to="/vendor/dashboard" replace />} />
                <Route path="/vendors/dashboard" element={<Navigate to="/vendor/dashboard" replace />} />
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
