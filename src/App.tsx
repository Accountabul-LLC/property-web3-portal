import React, { Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ActiveWalletProvider } from "@/contexts/ActiveWalletContext";
import { ThemeProvider } from "next-themes";
import KycGate from "./components/KycGate";
import { AppRouteSkeleton } from "@/components/PageSkeletons";
const Index = React.lazy(() => import("./pages/Index"));
const Marketplace = React.lazy(() => import("./pages/Marketplace"));
const Tokenize = React.lazy(() => import("./pages/Tokenize"));
const Auth = React.lazy(() => import("./pages/Auth"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Professionals = React.lazy(() => import("./pages/Professionals"));
const AIAgents = React.lazy(() => import("./pages/AIAgents"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const PropertyDetail = React.lazy(() => import("./pages/PropertyDetail"));
const Mint = React.lazy(() => import("./pages/Mint"));
const Swap = React.lazy(() => import("./pages/Swap"));
const Kyc = React.lazy(() => import("./pages/Kyc"));
const KycStatus = React.lazy(() => import("./pages/KycStatus"));
const AdminKyc = React.lazy(() => import("./pages/AdminKyc"));
const Admin = React.lazy(() => import("./pages/Admin"));
const AdminAIPanel = React.lazy(() => import("./pages/AdminAIPanel"));
const AdminCredentials = React.lazy(() => import("./pages/AdminCredentials"));
const ActionItems = React.lazy(() => import("./pages/ActionItems"));
const Credentials = React.lazy(() => import("./pages/Credentials"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ActiveWalletProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Suspense
              fallback={<AppRouteSkeleton />}
            >
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
                <Route path="/swap" element={<Swap />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/mint" element={<KycGate><Mint /></KycGate>} />
                <Route path="/kyc" element={<Kyc />} />
                <Route path="/kyc/status" element={<KycStatus />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/kyc" element={<AdminKyc />} />
                <Route path="/admin/ai-panel" element={<AdminAIPanel />} />
                <Route path="/admin/credentials" element={<AdminCredentials />} />
                <Route path="/action-items" element={<ActionItems />} />
                <Route path="/credentials" element={<Credentials />} />
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
