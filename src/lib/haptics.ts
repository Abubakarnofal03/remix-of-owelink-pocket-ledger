import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Check if haptics is available
const isHapticsAvailable = () => Capacitor.isNativePlatform();

// Get intensity from localStorage
const getIntensity = (): "off" | "low" | "medium" | "high" => {
  if (typeof window === "undefined") return "medium";
  return (localStorage.getItem("app-haptic-intensity") as any) || "medium";
};

// Map intensity to impact style
const getImpactStyle = (base: ImpactStyle): ImpactStyle | null => {
  const intensity = getIntensity();
  if (intensity === "off") return null;
  if (intensity === "low") return ImpactStyle.Light;
  if (intensity === "high") return ImpactStyle.Heavy;
  return base; // medium uses the base style
};

export const hapticLight = async () => {
  if (!isHapticsAvailable()) return;
  const style = getImpactStyle(ImpactStyle.Light);
  if (!style) return;
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticMedium = async () => {
  if (!isHapticsAvailable()) return;
  const style = getImpactStyle(ImpactStyle.Medium);
  if (!style) return;
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticHeavy = async () => {
  if (!isHapticsAvailable()) return;
  const style = getImpactStyle(ImpactStyle.Heavy);
  if (!style) return;
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticSuccess = async () => {
  if (!isHapticsAvailable() || getIntensity() === "off") return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticWarning = async () => {
  if (!isHapticsAvailable() || getIntensity() === "off") return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticError = async () => {
  if (!isHapticsAvailable() || getIntensity() === "off") return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

export const hapticSelection = async () => {
  if (!isHapticsAvailable() || getIntensity() === "off") return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};
