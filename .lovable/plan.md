# Smart Transaction Detection & Expense Suggestion

Passively detect financial transactions from Android notifications (and optionally SMS) and turn them into **expense suggestions** that the user confirms. Nothing is ever auto-saved — the user always taps Add, Review, or Ignore.

## Scope of this plan

- **Android only.** iOS does not allow reading other apps' notifications/SMS, so this feature is gated behind `Capacitor.getPlatform() === 'android'`.
- Suggestions feed into the existing `expenses` table (via `useExpenses.createExpense`). No schema changes to server tables.
- All parsing, dedupe, and storage of raw notification text happens **on-device only**. Only confirmed expenses sync to the backend.

## User flow

1. User grants Notification Access (and optionally SMS) once from Settings → "Smart Expense Detection".
2. Bank/wallet app posts a notification (e.g. "Rs 500 debited at KFC via Meezan Bank").
3. Native listener forwards the text to the JS layer, where it is parsed, deduped, and scored.
4. A local Android notification appears: **"💡 Add Expense — Rs 500 at KFC"** with actions **Add / Review / Ignore**.
5. User taps:
   - **Add** → expense saved silently with auto-category.
   - **Review** → app opens prefilled expense form (`/expenses/new?suggestion=<id>`).
   - **Ignore** → suggestion dismissed and merchant optionally muted.
6. An in-app **Suggestions inbox** (badge on the Expenses tab) lists pending suggestions for users who missed the notification.

## What gets built

### 1. Native Android layer (new files in `android/app/.../`)
- `TxnNotificationListener.java` — `NotificationListenerService` that captures notifications from a whitelist of bank/wallet packages (Meezan, HBL, UBL, Alfalah, JazzCash, EasyPaisa, Sadapay, Nayapay, default SMS apps) and forwards `{packageName, title, text, postedAt}` to the bridge.
- `SmsReceiver.java` (optional, behind a toggle) — `BroadcastReceiver` for `SMS_RECEIVED` from known bank shortcodes.
- `TxnBridge.java` — Capacitor plugin exposing:
  - `requestNotificationAccess()` → opens Android settings page.
  - `hasNotificationAccess()` → boolean.
  - `requestSmsPermission()` / `hasSmsPermission()`.
  - `showSuggestionNotification({id, title, body, actions})` with Add / Review / Ignore PendingIntents.
  - Emits `txnSignal` event to JS with the raw payload.
  - Emits `suggestionAction` event when user taps Add/Ignore from the notification (Review just deep-links via existing `owelink://` scheme).
- `AndroidManifest.xml` — register the listener service, SMS permission/receiver (guarded), and intent filters for the suggestion action buttons. Register both plugins in `MainActivity.java`.

### 2. JS parsing & suggestion pipeline (new `src/lib/txnDetection/`)
- `parser.ts` — regex + keyword rules to extract `{amount, currency, merchant, type: debit|credit, source, timestamp, rawText}`. Handles common patterns: `Rs 500`, `PKR 1,234.00`, `debited/credited/spent/received`, "at <merchant>", "to <merchant>".
- `categorizer.ts` — merchant → category map (KFC/McDonald's → Food, Uber/Careem/InDrive → Transport, Spotify/Netflix → Subscription, K-Electric/SSGC → Bills, Steam/PlayStation → Gaming, fallback Miscellaneous). Maps to existing **expense buckets** when one matches by name.
- `dedupe.ts` — in-memory + Dexie-backed dedupe. Two signals merge if `|Δamount| < 0.01`, time within 5 minutes, and (source matches OR merchant fuzzy-matches via Levenshtein ≤ 2). Stores fingerprint in a new Dexie table `txn_signals` for 24h.
- `confidence.ts` — score 0–1 from: number of agreeing sources (+0.3 each), clean merchant string (+0.2), amount parsed cleanly (+0.2), known package (+0.3). Thresholds: ≥0.7 high (notify), 0.4–0.7 medium (notify, marked "Low confidence"), <0.4 inbox-only.
- `suggestionStore.ts` — new Dexie table `expense_suggestions` with `{id, amount, currency, merchant, category, bucketId?, source, timestamp, rawText, confidence, status: 'pending'|'added'|'ignored'|'reviewed', createdAt}`.

### 3. JS glue (new `src/hooks/useTxnDetection.tsx`)
- Mounted once inside `<AuthProvider>` (in `App.tsx`), only when platform is Android and the user has enabled the feature in settings.
- Subscribes to `txnSignal` from the bridge → parser → dedupe → confidence → store → trigger native `showSuggestionNotification` for medium/high confidence.
- Subscribes to `suggestionAction`:
  - `add` → calls `useExpenses.createExpense` with parsed data, marks suggestion `added`, toasts in-app if open.
  - `ignore` → marks `ignored`, optionally adds merchant to mute list.
- Listens for app deep link `owelink://suggestion/<id>` to open the prefilled form.

### 4. UI
- **Settings page** — new card "Smart Expense Detection" with toggles: Enable notifications scanning, Enable SMS scanning (Android only), Auto-ignore low confidence, Manage banking apps list, Manage muted merchants. Buttons trigger the native permission flows.
- **Suggestions inbox** — new `src/pages/Suggestions.tsx` listing pending suggestions with Add / Review / Ignore buttons. Badge count surfaced on the Expenses tab in `BottomNav` (no new tab to keep the flat 6-tab structure).
- **Prefilled expense form** — extend the existing `NewExpense`/add-expense entry point (whatever opens from Expenses) to read `?suggestion=<id>`, prefill amount/description/bucket, and mark the suggestion `added` on submit.

### 5. Privacy guarantees
- `txn_signals` and `expense_suggestions` tables are local-only (Dexie). Never added to the sync queue.
- `rawText` is stored in the local suggestion only; when saving as an expense we put a short, sanitized note (e.g. "KFC via Meezan Bank") in `description`, not the raw banking text, unless the user edits it in.
- Bank package whitelist is hardcoded — listener ignores anything else, so social/chat notifications are never read.

## Technical notes

- **Capacitor plugin pattern:** mirrors the existing `WidgetBridge` / `AppUpdater` plugins. Registered in `MainActivity.java` and wrapped by a typed TS facade in `src/lib/txnDetection/nativeBridge.ts`.
- **Notification actions:** Android `NotificationCompat.Action` with PendingIntents pointing to a small `SuggestionActionReceiver` that calls back into the plugin (so Add works without opening the app, per spec).
- **Dedupe storage:** new Dexie store version bump in `src/lib/offline/db.ts` adding `txn_signals` and `expense_suggestions` indexes (`++id, status, createdAt, fingerprint`).
- **iOS:** hide the Settings card and short-circuit the hook — feature simply doesn't exist on iOS.
- **Permissions UX:** Notification Access requires the user to flip a system toggle; show an explainer sheet before opening Android settings.

## Out of scope (deferred to "Future Enhancements")

- AI/LLM-based merchant recognition.
- Subscription / recurring detection from signals.
- Auto split into IOUs.
- Email parsing.
- Budget warnings driven by suggestions.

## Files touched

**New**
- `android/.../TxnNotificationListener.java`, `SmsReceiver.java`, `TxnBridge.java`, `SuggestionActionReceiver.java`
- `src/lib/txnDetection/{parser,categorizer,dedupe,confidence,suggestionStore,nativeBridge}.ts`
- `src/hooks/useTxnDetection.tsx`
- `src/pages/Suggestions.tsx`

**Edited**
- `android/app/src/main/AndroidManifest.xml` — listener service, SMS permission, intent filters.
- `android/.../MainActivity.java` — register `TxnBridge`.
- `src/lib/offline/db.ts` — new local tables (version bump).
- `src/App.tsx` — mount `useTxnDetection` for Android users.
- `src/pages/Settings.tsx` — new "Smart Expense Detection" section.
- `src/pages/Expenses.tsx` + `BottomNav.tsx` — suggestions badge entry point.
- Existing add-expense form — accept `?suggestion=<id>` prefill.
