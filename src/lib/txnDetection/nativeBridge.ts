import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface TxnSignalPayload {
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
}

export interface SuggestionActionPayload {
  id: string;
  action: 'add' | 'ignore';
}

interface TxnBridgePlugin {
  hasNotificationAccess(): Promise<{ granted: boolean }>;
  requestNotificationAccess(): Promise<void>;
  hasSmsPermission(): Promise<{ granted: boolean }>;
  requestSmsPermission(): Promise<void>;
  showSuggestionNotification(opts: {
    id: string;
    title: string;
    body: string;
    deepLink?: string;
  }): Promise<void>;
  addListener(eventName: 'txnSignal', cb: (p: TxnSignalPayload) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'suggestionAction', cb: (p: SuggestionActionPayload) => void): Promise<PluginListenerHandle>;
}

const Plugin = registerPlugin<TxnBridgePlugin>('TxnBridge');

export function isTxnDetectionSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function hasNotificationAccess(): Promise<boolean> {
  if (!isTxnDetectionSupported()) return false;
  try { return (await Plugin.hasNotificationAccess()).granted; } catch { return false; }
}

export async function requestNotificationAccess(): Promise<void> {
  if (!isTxnDetectionSupported()) return;
  try { await Plugin.requestNotificationAccess(); } catch { /* ignore */ }
}

export async function hasSmsPermission(): Promise<boolean> {
  if (!isTxnDetectionSupported()) return false;
  try { return (await Plugin.hasSmsPermission()).granted; } catch { return false; }
}

export async function requestSmsPermission(): Promise<void> {
  if (!isTxnDetectionSupported()) return;
  try { await Plugin.requestSmsPermission(); } catch { /* ignore */ }
}

export async function showSuggestionNotification(opts: {
  id: string; title: string; body: string; deepLink?: string;
}): Promise<void> {
  if (!isTxnDetectionSupported()) return;
  try { await Plugin.showSuggestionNotification(opts); } catch (e) { console.warn('[TxnBridge] show error', e); }
}

export function onTxnSignal(cb: (p: TxnSignalPayload) => void): Promise<PluginListenerHandle> | null {
  if (!isTxnDetectionSupported()) return null;
  return Plugin.addListener('txnSignal', cb);
}

export function onSuggestionAction(cb: (p: SuggestionActionPayload) => void): Promise<PluginListenerHandle> | null {
  if (!isTxnDetectionSupported()) return null;
  return Plugin.addListener('suggestionAction', cb);
}
