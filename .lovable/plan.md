## Bug Fixes: Dashboard Loading Speed & Engagement Notification Spam

### Bug 1: Dashboard shows zeros for 2-3 seconds

**Root cause:** `useBalances` uses `isOnline` check and always tries the server first with a 5-second timeout. While waiting, `isLoading` is true and the UI shows `0` for all amounts. There's no instant cache-first strategy.

**Fix:** Load local IndexedDB data immediately as the initial/placeholder data, then silently refresh from the server in the background. This way numbers appear instantly from cache on every app open.

Changes to `src/hooks/useBalances.tsx`:

- Add a `placeholderData` or `initialData` function that synchronously returns cached local DB data
- Better approach: split into two queries — one instant local query, one background server query. Or simpler: always fetch local first (fast), then trigger a background server fetch that updates the cache.
- Concretely: change `queryFn` to always return local data first, then fire-and-forget a server sync that invalidates the query when done. This matches the existing `non-blocking-list-queries` architecture pattern already used for bills/IOUs lists.

Changes to `src/pages/Index.tsx`:

- Stop showing `0` while loading — show the cached values immediately instead of `balancesLoading ? 0 : owedToYou`

### Bug 2: All engagement notifications arrive at the same time

**Root cause:** The edge function `send-engagement-notifications` runs once (via cron at 12:00 PM UTC), and for each user it sends 2-3 notifications all at once in a tight loop. There's no delay or spreading.

**Fix:** Change the approach so only **1 notification per user per invocation** is sent, and schedule the cron to run **3-4 times per day at random-ish intervals** (e.g., 9 AM, 1 PM, 5 PM, 8 PM UTC — staggered). Each invocation picks just 1 random notification for each user.

Changes to `supabase/functions/send-engagement-notifications/index.ts`:

- Change from sending 2-3 notifications to sending exactly **1** notification per user per invocation
- Remove the `count = Math.random() < 0.5 ? 2 : 3` logic — always pick 1
- Remove the confirmation notifications to the creditor (the "Done! They just got a nudge" messages) — user explicitly asked for no owner notifications from engagement nudges

**Cron schedule change** (via SQL):

- Update the cron job to run 3-4 times daily at spread-out hours (e.g., `0 8,13,17,21 * * *` — 8 AM, 1 PM, 5 PM, 9 PM UTC)
- Each run sends only 1 random notification per user, so throughout the day users get 3-4 spaced-out nudges instead of a burst

### Summary of files to change

1. `**src/hooks/useBalances.tsx**` — Local-first: return IndexedDB data immediately, background-sync server data
2. `**src/pages/Index.tsx**` — Remove `balancesLoading ? 0 : value` pattern, always show cached values
3. `**supabase/functions/send-engagement-notifications/index.ts**` — Send exactly 1 notification per user per invocation, no owner confirmations
4. **Cron job SQL** — Reschedule from single daily run to 3-4 spread-out runs per day