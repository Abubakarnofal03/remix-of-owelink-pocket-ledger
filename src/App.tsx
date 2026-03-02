import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { OfflineProvider } from "@/hooks/useOffline";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import { useCapacitor } from "@/hooks/useCapacitor";
import { useOnboarding } from "@/hooks/useOnboarding";
import { TourOverlay } from "@/components/ui/TourOverlay";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useBackButton } from "@/hooks/useBackButton";
import { useAppPermissions } from "@/hooks/useAppPermissions";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { UpdateDialog } from "@/components/UpdateDialog";
import { useBills } from "@/hooks/useBills";
import { useIOUs } from "@/hooks/useIOUs";
import { useContacts } from "@/hooks/useContacts";
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
import Expenses from "./pages/Expenses";
import Insights from "./pages/Insights";
import GroupExpenses from "./pages/GroupExpenses";
import NewGroupExpense from "./pages/NewGroupExpense";
import GroupExpenseDetail from "./pages/GroupExpenseDetail";
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
        offlineDb.clearAllData();
      }
    });

    return () => subscription.unsubscribe();
  }, [qc]);

  return null;
}

// Component to initialize Capacitor native features and pre-fetch data
function CapacitorInitializer() {
  const { user } = useAuth();
  useCapacitor();
  useAppPermissions();
  usePushNotifications();
  useBackButton();

  const update = useAppUpdate();

  // Pre-fetch bills, IOUs, and contacts when user is logged in
  const { bills } = useBills();
  const { ious } = useIOUs();
  const { contacts } = useContacts();

  return (
    <>
      {update.available && update.version && (
        <UpdateDialog
          open={update.available}
          versionName={update.version.version_name}
          releaseNotes={update.version.release_notes}
          isMandatory={update.version.is_mandatory}
          downloading={update.downloading}
          progress={update.progress}
          error={update.error}
          onUpdate={update.downloadAndInstallApk}
          onDismiss={update.dismissUpdate}
        />
      )}
    </>
  );
}

// Tour renderer - renders the overlay globally
function TourRenderer() {
  const { isActive, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, completeOnboarding } = useOnboarding();
  
  if (!isActive || !currentStep) return null;
  
  return (
    <TourOverlay
      step={currentStep}
      stepIndex={currentStepIndex}
      totalSteps={totalSteps}
      onNext={nextStep}
      onPrev={prevStep}
      onSkip={completeOnboarding}
    />
  );
}

// Wrapper component that uses router hooks (must be inside BrowserRouter)
function AppRoutes() {
  return (
    <>
      <CapacitorInitializer />
      <TourRenderer />
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
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/groups" element={<GroupExpenses />} />
        <Route path="/groups/new" element={<NewGroupExpense />} />
        <Route path="/groups/:id" element={<GroupExpenseDetail />} />
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
        <OfflineProvider>
          <CurrencyProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </CurrencyProvider>
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
