

## Plan: Fix Dashboard "You Owe" and WhatsApp Number Formatting

### Issue 1: "You Owe" Showing Rs0.00

**Root cause**: The `useBalances` hook prioritizes local IndexedDB data. If the user has ANY local data (e.g., bills they created → `owedToYou > 0`), it returns immediately with potentially stale `youOwe = 0` and does a background server fetch. However, bills/IOUs where the user is the *debtor* may not be in local DB yet (sync hasn't run or completed). The background fetch should fix this via `setQueryData`, but the initial flash of 0 is what the user sees, and if the background fetch fails silently, it stays at 0.

**Fix in `src/hooks/useBalances.tsx`**: When online, always use server data as the primary source. Use local data only as a fallback when offline or when the server times out. Remove the "local-first, server-background" pattern.

```
queryFn flow:
  1. If online → fetch from server directly (with 5s timeout)
     - On success: return server data
     - On timeout/error: fall back to local DB
  2. If offline → fetch from local DB
```

### Issue 2: WhatsApp Number Formatting

**Root cause**: `formatPhoneForWhatsApp()` in `src/lib/phoneUtils.ts` strips leading zeros and tries to prepend a country code. For numbers saved as `03121729411`, it strips the `0` and prepends `92`, making `923121729411` — but this logic is unreliable because:
- The app isn't country-specific
- The `defaultCountryCode` is just the first 2 digits of the user's own number, which may be wrong
- Numbers saved with a leading `0` work fine on WhatsApp as-is

**Fix in `src/lib/phoneUtils.ts`**: Simplify `formatPhoneForWhatsApp`:
- If number starts with `+`, strip the `+` and return digits (wa.me format)
- If number starts with `0`, return as-is (WhatsApp handles local numbers)
- Otherwise, return the raw digits without any manipulation

**Update all callers** (BillDetail, IOUDetail, IOUCard, BillCard, GroupedIOUList) to stop passing `defaultCountryCode` since it's no longer used.

### Files to Change
1. `src/hooks/useBalances.tsx` — Rewrite queryFn to use server-first when online
2. `src/lib/phoneUtils.ts` — Simplify `formatPhoneForWhatsApp` to not manipulate numbers
3. `src/pages/BillDetail.tsx` — Remove `userCountryCode` from WhatsApp call
4. `src/pages/IOUDetail.tsx` — Remove `userCountryCode` from WhatsApp call
5. `src/components/ious/IOUCard.tsx` — Remove `userCountryCode` from WhatsApp call
6. `src/components/bills/BillCard.tsx` — Remove `userCountryCode` from WhatsApp call

