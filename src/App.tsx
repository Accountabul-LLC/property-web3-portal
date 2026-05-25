import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ActiveWalletProvider } from "@/contexts/ActiveWalletContext";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import Tokenize from "./pages/Tokenize";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Professionals from "./pages/Professionals";
import AIAgents from "./pages/AIAgents";
import Portfolio from "./pages/Portfolio";
import PropertyDetail from "./pages/PropertyDetail";
import Mint from "./pages/Mint";
import Swap from "./pages/Swap";
import Pools from "./pages/Pools";
import Treasury from "./pages/Treasury";
import Kyc from "./pages/Kyc";
import KycStatus from "./pages/KycStatus";
import AdminKyc from "./pages/AdminKyc";
import Admin from "./pages/Admin";
import AdminAIPanel from "./pages/AdminAIPanel";
import AdminCredentials from "./pages/AdminCredentials";
import ActionItems from "./pages/ActionItems";
import Credentials from "./pages/Credentials";
import AdminCauses from "./pages/AdminCauses";
import Causes from "./pages/Causes";
import CauseDetail from "./pages/CauseDetail";
import CauseApply from "./pages/CauseApply";
import KycGate from "./components/KycGate";
import { RouteGuard } from "./components/RouteGuard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ActiveWalletProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/tokenize" element={<RouteGuard adminOnly><KycGate><Tokenize /></KycGate></RouteGuard>} />
              <Route path="/professionals" element={<Professionals />} />
              <Route path="/ai-agents" element={<RouteGuard adminOnly><AIAgents /></RouteGuard>} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/swap" element={<RouteGuard adminOnly><Swap /></RouteGuard>} />
              <Route path="/pools" element={<RouteGuard adminOnly><Pools /></RouteGuard>} />
              <Route path="/treasury" element={<Treasury />} />
              <Route path="/property/:id" element={<PropertyDetail />} />
              <Route path="/mint" element={<RouteGuard adminOnly><KycGate><Mint /></KycGate></RouteGuard>} />

              <Route path="/kyc" element={<Kyc />} />
              <Route path="/kyc/status" element={<KycStatus />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/kyc" element={<AdminKyc />} />
              <Route path="/admin/ai-panel" element={<AdminAIPanel />} />
              <Route path="/admin/credentials" element={<AdminCredentials />} />
              <Route path="/admin/causes" element={<AdminCauses />} />
              <Route path="/action-items" element={<ActionItems />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/causes" element={<Causes />} />
              <Route path="/causes/apply" element={<CauseApply />} />
              <Route path="/causes/:slug" element={<CauseDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ActiveWalletProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
