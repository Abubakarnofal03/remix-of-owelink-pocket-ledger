import { Capacitor, registerPlugin } from '@capacitor/core';

interface WidgetBridgePlugin {
  updateWidget(options: {
    owedToYou: number;
    youOwe: number;
    netBalance: number;
  }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/**
 * Push the latest balance data to the native Android home-screen widget.
 * Safe to call on any platform – silently no-ops on web / iOS.
 */
export async function updateWidget(
  owedToYou: number,
  youOwe: number,
  netBalance: number
): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return; // widgets only exist on Android
  }

  try {
    await WidgetBridge.updateWidget({ owedToYou, youOwe, netBalance });
    console.log('[WidgetBridge] Widget updated successfully');
  } catch (e) {
    console.warn('[WidgetBridge] Failed to update widget:', e);
  }
}
