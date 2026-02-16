## Plan: Bulletproof Offline Auth + Better User-Friendliness

### Part 1: Fix the Logout Issue (Once and For All)

**Root Cause**: There's a race condition in the auth state listener. When `onAuthStateChange` fires with a null session (common on slow networks, app resume, or token expiry), the code immediately sets `user = null` on line 142. This triggers `Index.tsx` to redirect to `/auth` BEFORE the cached session restoration on line 162-171 can kick in.

**Fix Strategy -- "Never set user to null unless explicitly signed out"**:

1. **Initialize user/session from cache on mount** (before any async calls):
  - On component mount, if `logged_in` flag exists, immediately hydrate `user`, `session`, and `profile` from localStorage cache
  - This means `user` is never `null` for a logged-in user, even before Supabase responds
2. **Guard onAuthStateChange against false nulls**:
  - Only set `user = null` when `event === "SIGNED_OUT"` (explicit logout)
  - For all other events where session is null but `logged_in` flag exists, silently restore from cache without the brief null flash
  - Remove the pattern of "set null first, then restore" -- instead, skip the null entirely
3. **Guard getSession() similarly**:
  - If getSession returns null but `logged_in` flag is set, keep the cached state without flashing null

**Technical changes**:

- `src/hooks/useAuth.tsx`: 
  - Initialize `useState` for user/session/profile from cache (synchronous, on first render)
  - In `onAuthStateChange`, do NOT set user/session to null unless event is `SIGNED_OUT`
  - Set `loading = false` immediately if cache is available on mount
  - In `getSession()` handler, same guard

### Part 2: Improve User-Friendliness for New/Non-Technical Users

**Problem**: A new user (especially aged 30-50) opening the app doesn't immediately understand what each feature does or how to start using it. The existing tutorial helps but the app itself could be more self-explanatory.

**Improvements**:

1. **Better Empty States with Action Guidance**:
  - When a user has no bills, instead of just "No bills yet", show a friendly illustration-style message like:
    - "Split a dinner bill? A trip? Tap + to get started"
  - Same for Owes: "Lent money to a friend? Track it here so you don't forget"
  - Same for Expenses: "Keep track of where your money goes"
  - Each empty state includes a prominent action button
2. **Contextual Tooltips on First Visit to Each Page**:
  - Add a small dismissible "tip" banner at the top of Bills, Owes, and Expenses pages that appears only on first visit
  - Example for Bills: "Bills let you split expenses with friends. Add a bill, pick participants, and the app calculates who owes what."
  - Stored in localStorage per page so it only shows once
3. **Friendlier Labels and Descriptions on Home Page**:
  - Add small helper text under each Quick Action button explaining what it does
  - "Split Bill" -> subtitle "Share expenses with friends"
  - "Track Owe" -> subtitle "Someone owes you?"  
  - "Add Expense" -> subtitle "Log your spending"
  - Add a small message on Owes and Bills section on top "to see individual history of person go to contacts->click on contact", just sophisticate this message.

**Technical changes**:

- `src/pages/Index.tsx`: Add subtitle text under Quick Action buttons
- `src/pages/Bills.tsx`: Enhanced empty state with friendly copy and action button; add first-visit tip banner
- `src/pages/IOUs.tsx`: Same treatment
- `src/pages/Expenses.tsx`: Same treatment  
- `src/components/ui/FirstVisitTip.tsx` (new): Reusable dismissible tip banner component that shows once per page