

## Plan: Engagement Notifications & Entertaining Reminders

### Overview

Two main changes:
1. **New edge function** `send-engagement-notifications` — a daily cron job that sends 2-3 random, fun engagement notifications per user based on their actual data (pending IOUs, unpaid bills, expense tracking nudges).
2. **Rewrite reminder notification messages** in both `send-bill-reminders` and `send-iou-reminders` to use randomized entertaining templates with emojis, and sometimes include "X days since..." context.
3. **Notify the creditor/creator** when a reminder is successfully sent to a debtor/participant — with a fun confirmation message.

---

### 1. New Edge Function: `send-engagement-notifications`

**File**: `supabase/functions/send-engagement-notifications/index.ts`

Runs daily via cron. For each user with registered device tokens:
- Query their data: pending IOUs (owed to them), pending bills, total owed, expense count
- Build a pool of applicable notification types:
  - **"Track an expense"** — generic nudge if they haven't logged expenses recently
  - **"Check your balances"** — if they have pending IOUs/bills
  - **"Someone owes you X"** — pick a random pending IOU and mention the amount
  - **"Add an IOU"** — if a friend hasn't paid, suggest creating one
  - **"WhatsApp nudge"** — suggest reminding a debtor via WhatsApp from the app
- Randomly pick 2-3 from the applicable pool
- Each type has 3-5 randomized message templates with emojis

Example messages:
- `"💰 Got expenses to track? Pop them in before you forget!"`
- `"👀 Someone still owes you $50... just saying 😏"`
- `"📊 Peek at your balances — you might be surprised!"`
- `"🤔 Lent money to a friend? Add an IOU so you don't forget"`

**Config**: Add to `supabase/config.toml`:
```toml
[functions.send-engagement-notifications]
verify_jwt = false
```

**Cron**: Set up a daily cron at ~12:00 PM UTC (different time than reminders at 9 AM) calling this function.

---

### 2. Make Reminder Messages Entertaining

**Files**: `supabase/functions/send-iou-reminders/index.ts`, `supabase/functions/send-bill-reminders/index.ts`

Replace the static "Payment Reminder: You owe X" messages with randomized fun templates.

For IOU reminders (to debtor):
- `"Hey! 💸 You still owe {amount} for {desc}. Time to square up!"`
- `"🔔 Friendly nudge — {amount} is waiting to be paid for {desc}"`
- `"😅 It's been {days} days... {amount} for {desc} is still hanging!"`  ← only sometimes include days
- `"💳 Quick reminder: {amount} for {desc}. Your wallet called, it's ready!"`

For bill reminders (to participants):
- `"📋 {title} is still waiting! You owe {amount}. Let's close this out 🎯"`
- `"⏰ Tick tock! {amount} for {title}. Don't leave everyone hanging!"`
- `"🧾 Just a nudge about {title} — {amount} remaining. {days} days and counting!"` ← sometimes

The "days since created/due" info is included randomly (~40% of the time) to keep it fresh.

---

### 3. Notify Creditor/Creator When Reminder Is Sent

In both reminder edge functions, after successfully sending reminders to debtors/participants:
- Look up the **creditor's** (IOU) or **creator's** (bill) device tokens
- Send them a fun confirmation notification:
  - `"📤 Reminder sent to {person}! They can't say they forgot now 😄"`
  - `"✅ Done! {person} just got a nudge about the {amount} they owe you"`
  - `"🔔 We poked {person} about {desc}. You're welcome 😎"`

For bills, `{person}` could say "2 people" if multiple participants were notified. For IOUs, use the debtor phone or a generic "your debtor."

---

### Files to Change

1. `supabase/functions/send-engagement-notifications/index.ts` — **New** edge function
2. `supabase/functions/send-iou-reminders/index.ts` — Entertaining templates + creditor notification
3. `supabase/functions/send-bill-reminders/index.ts` — Entertaining templates + creator notification
4. `supabase/config.toml` — Add engagement function config (auto-managed, just noting)

### Technical Details

- The engagement function queries `device_tokens` joined with user data to build per-user notification pools
- Uses `Math.random()` for template selection and for the "include days" coin flip
- Days calculation: `Math.floor((now - created_at) / 86400000)`
- Creditor/creator token lookup uses `creditor_id` / `creator_id` to find their `device_tokens` via the `profiles` table's `phone_suffix`
- The cron job for engagement notifications needs to be set up separately (daily at 12:00 UTC)

