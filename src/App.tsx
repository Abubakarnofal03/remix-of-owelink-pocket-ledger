import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { useCapacitor } from "@/hooks/useCapacitor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useBackButton } from "@/hooks/useBackButton";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Bills from "./pages/Bills";
import NewBill from "./pages/NewBill";
import BillDetail from "./pages/BillDetail";
import IOUs from "./pages/IOUs";
import NewIOU from "./pages/NewIOU";
import IOUDetail from "./pages/IOUDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

// Component to clear cache on auth state changes
function AuthCacheClearer() {
  const qc = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Clear all cached data when user signs out
        qc.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [qc]);

  return null;
}

// Component to initialize Capacitor native features
function CapacitorInitializer() {
  useCapacitor();
  usePushNotifications();
  useBackButton();
  return null;
}

// Wrapper component that uses router hooks (must be inside BrowserRouter)
function AppRoutes() {
  return (
    <>
      <CapacitorInitializer />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/bills/new" element={<NewBill />} />
        <Route path="/bills/:id" element={<BillDetail />} />
        <Route path="/ious" element={<IOUs />} />
        <Route path="/ious/new" element={<NewIOU />} />
        <Route path="/ious/:id" element={<IOUDetail />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthCacheClearer />
      <AuthProvider>
        <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
