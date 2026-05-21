import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from './useAuth';
import { useExpenses } from './useExpenses';
import { useExpenseBuckets } from './useExpenseBuckets';
import {
  isTxnDetectionSupported,
  onTxnSignal,
  onSuggestionAction,
  showSuggestionNotification,
  hasNotificationAccess,
} from '@/lib/txnDetection/nativeBridge';
import { parseTxnSignal } from '@/lib/txnDetection/parser';
import { dedupeSignal, scoreConfidence } from '@/lib/txnDetection/dedupe';
import { categorize, findBucketIdForCategory } from '@/lib/txnDetection/categorizer';
import {
  upsertSuggestion,
  getSuggestion,
  setSuggestionStatus,
  isMerchantMuted,
  muteMerchant,
} from '@/lib/txnDetection/suggestionStore';
import { toast } from 'sonner';

const ENABLED_KEY = 'txn_detection_enabled';
const AUTO_IGNORE_LOW_KEY = 'txn_detection_auto_ignore_low';

export function isTxnDetectionEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}
export function setTxnDetectionEnabled(v: boolean): void {
  localStorage.setItem(ENABLED_KEY, v ? '1' : '0');
}
export function isAutoIgnoreLow(): boolean {
  return localStorage.getItem(AUTO_IGNORE_LOW_KEY) === '1';
}
export function setAutoIgnoreLow(v: boolean): void {
  localStorage.setItem(AUTO_IGNORE_LOW_KEY, v ? '1' : '0');
}

/**
 * Subscribes to native transaction signals and turns them into expense suggestions.
 * Safe no-op on iOS / web / when feature is disabled.
 */
export function useTxnDetection() {
  const { user, currency } = useAuth();
  const { createExpense } = useExpenses();
  const { buckets } = useExpenseBuckets();
  const navigate = useNavigate();

  const bucketsRef = useRef(buckets);
  const currencyRef = useRef(currency);
  const createExpenseRef = useRef(createExpense);

  useEffect(() => { bucketsRef.current = buckets; }, [buckets]);
  useEffect(() => { currencyRef.current = currency; }, [currency]);
  useEffect(() => { createExpenseRef.current = createExpense; }, [createExpense]);

  useEffect(() => {
    if (!user) return;
    if (!isTxnDetectionSupported()) return;
    if (!isTxnDetectionEnabled()) return;

    let signalHandle: PluginListenerHandle | null = null;
    let actionHandle: PluginListenerHandle | null = null;
    let cancelled = false;

    (async () => {
      // Only run if permission granted (silent — UI in Settings handles requests)
      const granted = await hasNotificationAccess();
      if (!granted || cancelled) return;

      const s = onTxnSignal(async (payload) => {
        try {
          const parsed = parseTxnSignal(payload);
          if (parsed.amount == null || parsed.amount <= 0) return;
          if (parsed.type === 'credit') return; // only suggest expenses
          if (isMerchantMuted(parsed.merchant)) return;

          const dd = await dedupeSignal(parsed);
          const confidence = scoreConfidence(parsed, dd.agreeingSources);

          if (dd.isDuplicate) {
            // Update the existing pending suggestion's confidence if any
            return;
          }

          const category = categorize(parsed.merchant, parsed.rawText);
          const bucketId = findBucketIdForCategory(category, bucketsRef.current);

          const id = `sug_${dd.fingerprint}_${Date.now()}`;
          const suggestion = {
            id,
            amount: parsed.amount,
            currency: parsed.currency || currencyRef.current,
            merchant: parsed.merchant,
            category,
            bucketId,
            source: parsed.source,
            timestamp: parsed.timestamp,
            rawText: parsed.rawText,
            confidence,
            status: 'pending' as const,
            createdAt: Date.now(),
          };
          await upsertSuggestion(suggestion);

          if (confidence < 0.4 && isAutoIgnoreLow()) {
            await setSuggestionStatus(id, 'ignored');
            return;
          }

          if (confidence >= 0.4) {
            const merchantLabel = parsed.merchant || category;
            const body = `${parsed.currency} ${parsed.amount.toFixed(2)} at ${merchantLabel}` +
              (parsed.source ? ` via ${parsed.source}` : '');
            await showSuggestionNotification({
              id,
              title: confidence >= 0.7 ? '💡 Add Expense Detected' : 'Possible Expense',
              body,
              deepLink: `owelink://suggestion/${id}`,
            });
          }
        } catch (e) {
          console.warn('[useTxnDetection] signal error', e);
        }
      });
      if (s) signalHandle = await s;

      const a = onSuggestionAction(async ({ id, action }) => {
        try {
          const sug = await getSuggestion(id);
          if (!sug || sug.status !== 'pending') return;

          if (action === 'add') {
            await createExpenseRef.current({
              amount: sug.amount,
              description: sug.merchant
                ? `${sug.merchant}${sug.source ? ` · ${sug.source}` : ''}`
                : sug.source || sug.category || 'Detected expense',
              currency: sug.currency,
              bucket_id: sug.bucketId || undefined,
            });
            await setSuggestionStatus(id, 'added');
            toast.success(`Added ${sug.currency} ${sug.amount.toFixed(2)}`);
          } else if (action === 'ignore') {
            await setSuggestionStatus(id, 'ignored');
            if (sug.merchant) muteMerchant(sug.merchant);
          }
        } catch (e) {
          console.warn('[useTxnDetection] action error', e);
        }
      });
      if (a) actionHandle = await a;
    })();

    return () => {
      cancelled = true;
      signalHandle?.remove?.();
      actionHandle?.remove?.();
    };
  }, [user]);

  // Deep-link: owelink://suggestion/<id> -> /suggestions?focus=<id>
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (typeof url === 'string' && url.startsWith('owelink://suggestion/')) {
        const id = url.replace('owelink://suggestion/', '');
        navigate(`/suggestions?focus=${encodeURIComponent(id)}`);
      }
    };
    window.addEventListener('owelink-deeplink', handler);
    return () => window.removeEventListener('owelink-deeplink', handler);
  }, [navigate]);
}
