
# Plan: Add AI Insights, Recurring Bills/IOUs, and Stripe Subscription

This plan implements three premium features for Owelink: AI-powered spending insights, recurring bills/IOUs, and a Stripe-powered subscription paywall at $2.99/month.

---

## Feature 1: AI-Powered Smart Insights

A new "Insights" page accessible from the dashboard that analyzes the user's bills, IOUs, and expenses using Lovable AI to generate a personalized financial summary.

### What the user sees:
- A new "Insights" card on the dashboard with a sparkle icon
- Tapping it opens a dedicated `/insights` page
- The page shows an AI-generated summary covering:
  - Monthly spending trends
  - Who owes the most / who you owe the most
  - Payment reliability patterns
  - Debt clearance predictions
  - Actionable tips (e.g., "Follow up with X, they have 3 overdue IOUs")
- A "Refresh Insights" button to regenerate
- Results are cached locally so it doesn't call AI every time

### Technical approach:
1. **New edge function** `supabase/functions/ai-insights/index.ts`:
   - Receives the user's financial summary data (totals, counts, top debtors) from the client
   - Sends it to Lovable AI (google/gemini-3-flash-preview) with a financial analysis system prompt
   - Returns structured insights as non-streaming JSON response
2. **New page** `src/pages/Insights.tsx` with the insights UI
3. **New hook** `src/hooks/useInsights.tsx` that:
   - Gathers summary data from local DB (bills, IOUs, expenses)
   - Calls the edge function
   - Caches results in localStorage with a timestamp (refresh every 24h or on demand)
4. **Dashboard update**: Add an "AI Insights" card to `src/pages/Index.tsx`
5. **Route**: Add `/insights` to `src/App.tsx`

---

## Feature 2: Recurring Bills and IOUs

Allow users to set bills and IOUs as recurring (weekly, monthly, yearly) so they auto-create new entries on schedule.

### What the user sees:
- In the Bill and IOU creation forms, a new "Recurring" toggle
- When enabled, shows frequency options: Weekly, Monthly, Yearly
- Active recurring items show a recurring icon badge
- A "Recurring" section in Settings to view/manage all active recurring schedules
- New entries are auto-created by a scheduled backend function

### Technical approach:
1. **Database migration**: New `recurring_schedules` table:
   - `id`, `user_id`, `entity_type` (bill/iou), `template_data` (JSONB with the bill/IOU fields), `frequency` (weekly/monthly/yearly), `next_run_at`, `last_run_at`, `is_active`, `created_at`
   - RLS: users can only manage their own schedules
2. **New edge function** `supabase/functions/process-recurring/index.ts`:
   - Queries `recurring_schedules` where `next_run_at <= now()` and `is_active = true`
   - For each, creates the corresponding bill or IOU entry
   - Updates `next_run_at` based on frequency
   - Can be triggered via a cron-like mechanism or called periodically
3. **Form updates**:
   - `src/components/ious/IOUForm.tsx`: Add recurring toggle + frequency selector
   - `src/components/bills/BillForm.tsx`: Add recurring toggle + frequency selector
4. **New hook** `src/hooks/useRecurring.tsx` for CRUD on recurring schedules
5. **Settings section**: Add a "Recurring" management area in Settings page

---

## Feature 3: Stripe Subscription ($2.99/month Pro Plan)

Implement a subscription paywall that gates the premium features (AI Insights, Recurring, unlimited IOUs/bills).

### What the user sees:
- Free tier limits: 10 active IOUs, 5 active bills, 20 contacts, no AI insights, no recurring
- When hitting a limit, a premium upgrade sheet appears
- Settings page shows subscription status and "Upgrade to Pro" button
- Pro plan: $2.99/month or $24.99/year
- Features unlocked: Unlimited everything, AI Insights, Recurring bills/IOUs, PDF exports

### Technical approach:
1. **Enable Stripe** via the Stripe integration tool
2. **Database migration**: Add `subscription_status` and `subscription_tier` columns to `profiles` table (or a new `subscriptions` table)
3. **Stripe products**: Create "Owelink Pro Monthly" ($2.99) and "Owelink Pro Yearly" ($24.99) products
4. **Edge functions** for Stripe checkout and webhook handling
5. **New hook** `src/hooks/useSubscription.tsx`:
   - Checks subscription status from profile
   - Provides `isPro`, `canUseFeature(feature)`, `openUpgrade()` helpers
6. **Paywall component** `src/components/premium/UpgradeSheet.tsx`:
   - Bottom sheet showing Pro benefits and pricing
   - "Subscribe" button triggers Stripe checkout
7. **Gate premium features**:
   - AI Insights page: check `isPro` before calling edge function
   - Recurring toggle: show lock icon and upgrade prompt for free users
   - IOUs/Bills: check count limits before creation
8. **Settings update**: Show subscription status, manage/cancel subscription link

---

## Implementation Order

1. **Stripe Subscription** (foundation -- gates everything else)
2. **AI Insights** (most impactful premium feature)
3. **Recurring Bills/IOUs** (builds on existing bill/IOU creation)

## Files to Create
- `supabase/functions/ai-insights/index.ts`
- `supabase/functions/process-recurring/index.ts`
- `src/pages/Insights.tsx`
- `src/hooks/useInsights.tsx`
- `src/hooks/useRecurring.tsx`
- `src/hooks/useSubscription.tsx`
- `src/components/premium/UpgradeSheet.tsx`

## Files to Modify
- `src/App.tsx` (add routes)
- `src/pages/Index.tsx` (add insights card, gate features)
- `src/pages/Settings.tsx` (add subscription status, recurring management)
- `src/components/ious/IOUForm.tsx` (add recurring toggle)
- `src/components/bills/BillForm.tsx` (add recurring toggle)
- `src/hooks/useIOUs.tsx` (add free tier limit check)
- `src/hooks/useBills.tsx` (add free tier limit check)
- `src/hooks/useContacts.tsx` (add free tier limit check)

## Database Migrations
- Add `recurring_schedules` table
- Add subscription columns to `profiles` or new `subscriptions` table
