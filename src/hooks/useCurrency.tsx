import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./useAuth";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/lib/currencies";

interface CurrencyContextType {
  currency: string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  
  // Get currency from profile settings, default to USD
  const currency = (profile?.settings as any)?.currency || DEFAULT_CURRENCY;
  const symbol = getCurrencySymbol(currency);

  return (
    <CurrencyContext.Provider value={{ currency, symbol }}>
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
