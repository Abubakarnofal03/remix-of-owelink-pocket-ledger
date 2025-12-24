import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Check if haptics is available
const isHapticsAvailable = () => Capacitor.isNativePlatform();

/**
 * Light impact - for subtle feedback (toggles, selections)
 */
export const hapticLight = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Medium impact - for button presses, confirmations
 */
export const hapticMedium = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Heavy impact - for important actions, deletions
 */
export const hapticHeavy = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Success notification - for completed actions
 */
export const hapticSuccess = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Warning notification - for warnings
 */
export const hapticWarning = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Error notification - for errors
 */
export const hapticError = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};

/**
 * Selection changed - for picker/scroll selections
 */
export const hapticSelection = async () => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    console.log("Haptic feedback not available");
  }
};
