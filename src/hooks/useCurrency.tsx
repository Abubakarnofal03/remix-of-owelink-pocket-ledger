import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./useAuth";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

interface CurrencyContextType {
  currency: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  
  // Get currency from profile settings, default to USD
  const currency = (profile?.settings as any)?.currency || DEFAULT_CURRENCY;

  return (
    <CurrencyContext.Provider value={{ currency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
