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
import Kyc from "./pages/Kyc";
import KycStatus from "./pages/KycStatus";
import AdminKyc from "./pages/AdminKyc";
import KycGate from "./components/KycGate";
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
              <Route path="/tokenize" element={<KycGate><Tokenize /></KycGate>} />
              <Route path="/professionals" element={<Professionals />} />
              <Route path="/ai-agents" element={<AIAgents />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/property/:id" element={<PropertyDetail />} />
              <Route path="/mint" element={<KycGate><Mint /></KycGate>} />
              <Route path="/kyc" element={<Kyc />} />
              <Route path="/kyc/status" element={<KycStatus />} />
              <Route path="/admin/kyc" element={<AdminKyc />} />
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
