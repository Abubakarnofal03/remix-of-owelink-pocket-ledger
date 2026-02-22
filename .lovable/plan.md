

# Fix "On Owelink" Connection Issues

## Root Cause

The `match-contacts` edge function's CORS `Access-Control-Allow-Headers` is missing headers that the Supabase JS client sends automatically. The client sends headers like `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, and `x-supabase-client-runtime-version`. When the browser's preflight (OPTIONS) request doesn't see these allowed, it blocks the actual request, resulting in "connection issue" errors.

Additionally, since this feature only works on native (Capacitor) and the web preview always shows "Contact matching is only available in the mobile app", the error might also occur on native when the function call fails due to CORS or network issues.

## Changes

### 1. `supabase/functions/match-contacts/index.ts` - Fix CORS headers

Update the `corsHeaders` to include all headers the Supabase JS client sends:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### 2. `src/hooks/useMatchedContacts.tsx` - Better error resilience

- On web (non-native), skip the edge function call entirely and avoid showing errors -- the `MatchedContactsList` component already handles this with a "mobile only" message, but the hook still runs and can produce error state.
- Add a `fetchedRef` guard so it doesn't re-fetch unnecessarily on every mount if not native.

No other file changes needed.

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/match-contacts/index.ts` | Add missing CORS allowed headers |
| `src/hooks/useMatchedContacts.tsx` | Skip fetch on non-native platforms to avoid error state |

