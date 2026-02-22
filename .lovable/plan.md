

# New Features: Group Expenses, Pin/Star Items, Dispute Flow, and Long-Press Actions

## Feature 1: Pin/Star Important Bills and IOUs

Add a `is_pinned` column to both `bills` and `ious` tables. Pinned items appear at the top of their respective lists with a star indicator.

**Database Changes:**
- Add `is_pinned BOOLEAN DEFAULT false` to `bills` table
- Add `is_pinned BOOLEAN DEFAULT false` to `ious` table

**Code Changes:**

| File | Change |
|------|--------|
| `src/hooks/useBills.tsx` | Add `is_pinned` to `Bill` interface and update/create functions |
| `src/hooks/useIOUs.tsx` | Add `is_pinned` to `IOU` interface and update/create functions |
| `src/pages/Bills.tsx` | Sort pinned bills to top, add pin toggle via long-press menu |
| `src/pages/IOUs.tsx` | Sort pinned IOUs to top (at group level) |
| `src/components/bills/BillCard.tsx` | Show star icon on pinned bills |
| `src/components/ious/IOUCard.tsx` | Show star icon on pinned IOUs |
| `src/lib/offline/db.ts` | Add `is_pinned` field to local DB schemas |
| `src/lib/offline/offlineDataLayer.ts` | Include `is_pinned` in offline operations |

---

## Feature 2: Long-Press Context Menu for Bills and IOUs

A long-press (touch hold 500ms) on a Bill card or IOU card opens a context menu with quick actions like Pin/Unpin, Edit, Delete, Share, Mark as Paid.

**Code Changes:**

| File | Change |
|------|--------|
| `src/components/ui/LongPressMenu.tsx` | **NEW** - Reusable long-press context menu component with haptic feedback. Uses `onTouchStart`/`onTouchEnd` with a 500ms timer. Renders a bottom sheet with action items. |
| `src/components/bills/BillCard.tsx` | Wrap card with `LongPressMenu`, provide actions: Pin/Unpin, Edit, Archive, Share via WhatsApp |
| `src/components/ious/IOUCard.tsx` | Wrap card with `LongPressMenu`, provide actions: Pin/Unpin, Edit, Archive, Mark as Paid |
| `src/lib/haptics.ts` | Add a `mediumImpact` haptic for long-press feedback (already has light/selection) |

Menu actions per card type:

**Bill Card long-press menu:**
- Pin / Unpin
- Edit Bill (navigates to detail with edit dialog open)
- Archive Bill
- Share via WhatsApp

**IOU Card long-press menu:**
- Pin / Unpin
- Edit (navigates to detail)
- Mark as Paid (quick toggle)
- Archive
- Send Reminder (WhatsApp)

---

## Feature 3: Group Expenses (Shared Expense Splitting)

Allow users to create expense groups where multiple people contribute and the app calculates who owes whom. This builds on top of the existing bills system.

**Database Changes:**
- New table `expense_groups`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `creator_id UUID NOT NULL`
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `currency TEXT DEFAULT 'USD'`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`
  - `deleted_at TIMESTAMPTZ`
  - RLS: creator can CRUD, members can SELECT

- New table `expense_group_members`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `group_id UUID NOT NULL REFERENCES expense_groups(id)`
  - `phone_number TEXT NOT NULL`
  - `phone_suffix TEXT`
  - `user_id UUID`
  - `nickname TEXT`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - RLS: group creator can CRUD, members can SELECT own

- New table `group_expenses`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `group_id UUID NOT NULL REFERENCES expense_groups(id)`
  - `paid_by_phone TEXT NOT NULL` (who paid)
  - `amount NUMERIC NOT NULL`
  - `description TEXT`
  - `split_type TEXT DEFAULT 'equal'` (equal, exact, percentage)
  - `split_details JSONB DEFAULT '{}'` (for custom splits)
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `deleted_at TIMESTAMPTZ`
  - RLS: group creator and members can CRUD

**Code Changes:**

| File | Change |
|------|--------|
| `src/pages/GroupExpenses.tsx` | **NEW** - Main page listing expense groups |
| `src/pages/GroupExpenseDetail.tsx` | **NEW** - Detail view showing group members, expenses, and settlement summary (who owes whom) |
| `src/pages/NewGroupExpense.tsx` | **NEW** - Create a new expense group, add members from contacts |
| `src/hooks/useExpenseGroups.tsx` | **NEW** - Hook for CRUD on expense groups, members, and group expenses |
| `src/components/groups/GroupCard.tsx` | **NEW** - Card showing group name, member count, total expenses |
| `src/components/groups/AddGroupExpenseDialog.tsx` | **NEW** - Dialog to add an expense to a group (who paid, amount, split type) |
| `src/components/groups/SettlementSummary.tsx` | **NEW** - Shows optimized "who owes whom" calculations using debt simplification |
| `src/lib/debtSimplification.ts` | **NEW** - Algorithm to minimize number of transactions needed to settle all debts |
| `src/App.tsx` | Add routes: `/groups`, `/groups/new`, `/groups/:id` |
| `src/components/layout/BottomNav.tsx` | Add "Groups" tab or integrate into existing navigation |
| `src/pages/Expenses.tsx` | Add a "Groups" section/link at the top |

**Settlement Algorithm** (`debtSimplification.ts`):
- Calculate net balance for each member (total paid - total owed)
- Separate into creditors (positive balance) and debtors (negative balance)
- Match largest debtor with largest creditor iteratively to minimize transactions

---

## Feature 4: Dispute Flow

Allow debtors to dispute an IOU or bill amount. The creator gets notified and can accept/reject the dispute.

**Database Changes:**
- New table `disputes`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `entity_type TEXT NOT NULL` ('iou' or 'bill')
  - `entity_id UUID NOT NULL`
  - `disputed_by_phone_suffix TEXT NOT NULL`
  - `disputed_by_user_id UUID`
  - `reason TEXT NOT NULL`
  - `proposed_amount NUMERIC` (optional counter-proposal)
  - `status TEXT DEFAULT 'open'` (open, accepted, rejected, resolved)
  - `creator_response TEXT`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`
  - RLS: disputant can INSERT/SELECT, entity creator can SELECT/UPDATE

**Code Changes:**

| File | Change |
|------|--------|
| `src/components/disputes/DisputeDialog.tsx` | **NEW** - Dialog for debtor to file a dispute (reason + optional counter-amount) |
| `src/components/disputes/DisputeCard.tsx` | **NEW** - Card showing dispute details, status badge, and response |
| `src/components/disputes/DisputeResponseDialog.tsx` | **NEW** - Dialog for creator to accept/reject dispute with response message |
| `src/hooks/useDisputes.tsx` | **NEW** - Hook for creating/fetching/updating disputes |
| `src/pages/IOUDetail.tsx` | Add "Dispute" button for debtors, show active disputes section |
| `src/pages/BillDetail.tsx` | Add "Dispute" button for participants (debtors), show disputes |
| `src/pages/Notifications.tsx` | Add dispute notification type rendering |

**Dispute Flow:**
1. Debtor taps "Dispute" on an IOU/Bill detail page
2. Fills in reason and optional counter-amount
3. Creator receives push notification
4. Creator sees dispute in the detail page with Accept/Reject options
5. If accepted: amount is adjusted (or IOU is marked resolved)
6. If rejected: debtor sees rejection reason, can file another dispute or accept

---

## Feature 5: Android/iOS Widgets

Widgets are **native platform features** that require code written outside the web layer. Here's how to implement them:

**For Android:**
- Widgets are built using Android's `AppWidgetProvider` in Java/Kotlin
- Create widget layouts in `android/app/src/main/res/layout/`
- Register in `AndroidManifest.xml`
- The widget reads data from a local SQLite/SharedPreferences cache that the Capacitor app updates on each sync
- Capacitor plugin bridge: create a custom Capacitor plugin that writes summary data (total owed, top 3 IOUs) to SharedPreferences so the widget can read it

**For iOS:**
- Widgets use SwiftUI `WidgetKit` (requires Xcode)
- Create a Widget Extension target in the iOS project
- Use App Groups to share data between the main app and widget
- Similar bridge: custom Capacitor plugin writes data to UserDefaults (App Group)

**This cannot be built within Lovable** since it requires native code in Android Studio/Xcode. The steps would be:
1. Export the project to GitHub
2. Open in Android Studio / Xcode
3. Create widget code natively
4. Build a Capacitor plugin to bridge data from the web app to the widget's data store
5. The widget would show: total amount owed to you, number of pending IOUs, quick-add button

I can provide the exact native code templates if you want to implement widgets after exporting the project.

---

## Implementation Order

1. **Pin/Star** - Small, standalone (database migration + UI)
2. **Long-Press Menu** - Depends on Pin feature for one of the actions
3. **Dispute Flow** - New table + UI additions to existing pages
4. **Group Expenses** - Largest feature, new tables + pages + algorithm

This is a significant amount of work. I'd recommend implementing them one at a time, starting with Pin/Star and Long-Press Menu as they're the quickest wins.

