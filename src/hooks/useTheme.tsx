import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "amoled" | "system";
type HapticIntensity = "off" | "low" | "medium" | "high";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark" | "amoled";
  hapticIntensity: HapticIntensity;
  setHapticIntensity: (intensity: HapticIntensity) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "app-theme";
const HAPTIC_KEY = "app-haptic-intensity";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(THEME_KEY) as Theme) || "system";
    }
    return "system";
  });

  const [hapticIntensity, setHapticIntensityState] = useState<HapticIntensity>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(HAPTIC_KEY) as HapticIntensity) || "medium";
    }
    return "medium";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "amoled">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    
    const updateTheme = () => {
      let resolved: "light" | "dark" | "amoled";
      
      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else if (theme === "amoled") {
        resolved = "amoled";
      } else {
        resolved = theme;
      }
      
      setResolvedTheme(resolved);
      root.classList.remove("light", "dark", "amoled");
      root.classList.add(resolved === "amoled" ? "dark" : resolved);
      // Add amoled class for super dark backgrounds
      if (resolved === "amoled") {
        root.classList.add("amoled");
      }
    };

    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  const setHapticIntensity = (intensity: HapticIntensity) => {
    setHapticIntensityState(intensity);
    localStorage.setItem(HAPTIC_KEY, intensity);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, hapticIntensity, setHapticIntensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
