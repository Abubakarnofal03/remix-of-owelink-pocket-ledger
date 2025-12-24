import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { hapticLight } from "@/lib/haptics";

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = async () => {
      // If on home page, minimize the app instead of closing
      if (location.pathname === "/" || location.pathname === "/auth") {
        await App.minimizeApp();
      } else {
        // Navigate back in history
        hapticLight();
        navigate(-1);
      }
    };

    // Add listener for hardware back button
    const listener = App.addListener("backButton", handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location.pathname]);
}
