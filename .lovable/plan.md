
## Plan: Add "I Owe Someone" Mode + Creditor Notifications

### What Changes

**1. Direction Toggle in IOUForm**
Add a toggle at the top of the IOU creation form with two modes:
- **"They owe me"** (default, current behavior) -- you are the creditor
- **"I owe them"** (new) -- you are the debtor

The toggle will be a styled segmented control using the existing Tabs component. When "I owe them" is selected:
- The label changes from "Who owes you?" to "Who do you owe?"
- The validation error changes accordingly
- Reminders are hidden (no point reminding yourself via push)

**2. Data Handling on Submit**
When "I owe them" is selected, the IOU is created with **swapped roles**:
- `creditor_id` = the selected contact's user (looked up via phone suffix), or left as a placeholder
- `debtor_phone_number` = the current user's phone number
- `debtor_user_id` = the current user's ID
- `debtor_phone_suffix` = the current user's phone suffix

Since the `ious` table requires `creditor_id` (the person owed money), and we may not know the creditor's `user_id`, we'll store the **creditor's phone number** in a new approach: create the IOU with `creditor_id = current_user` but add a flag field to distinguish direction. However, looking at the existing schema and RLS policies more carefully:

- RLS requires `creditor_id = auth.uid()` for INSERT
- The debtor view relies on `debtor_user_id` or phone suffix matching

**Best approach**: Keep `creditor_id = current_user` (so RLS INSERT works), but set `debtor_phone_number` to the **other person's phone** and add a new boolean column `is_reverse` (or `direction`) to indicate "I created this but I'm the debtor." Then in the query layer, when `is_reverse = true`, swap the display logic.

Actually, even simpler: We don't need a new column. We can use the existing structure differently:
- For "I owe them": set `creditor_id = current_user` (for RLS), `debtor_phone_number = current_user_phone`, `debtor_user_id = current_user_id`. The "other person" info goes into description or a new field.

Let me reconsider. The cleanest approach that works with existing RLS:

**Add a `direction` column** to the `ious` table:
- `direction = 'owed_to_me'` (default, current behavior)
- `direction = 'i_owe'` (new reverse mode)

For both directions, `creditor_id` remains `auth.uid()` (the creator). The `debtor_phone_number` always stores the **other person's** phone. The `direction` field tells the UI how to interpret the roles:
- `owed_to_me`: creator is creditor, other person is debtor (current)
- `i_owe`: creator is actually the debtor, other person is the creditor

**3. Notification to the Creditor (Preventing Duplicates)**
When "I owe them" is created, send a push notification to the other person (the real creditor) saying:
- Title: "Someone logged a debt to you"
- Body: "[Your name] recorded that they owe you [currency] [amount] for [description]"

This notification tells the creditor "don't create a duplicate entry -- it's already tracked." The notification includes `type: "iou"` and `id` for deep-linking.

**4. Display Logic Updates**
- In `useIOUs.tsx`, update `owedToMe` and `iOwe` filters to account for `direction`
- In `IOUCard.tsx` and `IOUDetail.tsx`, swap creditor/debtor display based on `direction`
- Reminders only apply to `direction = 'owed_to_me'` (skip reverse IOUs in the reminder edge function)

### Technical Details

**Database Migration:**
```sql
ALTER TABLE ious ADD COLUMN direction text NOT NULL DEFAULT 'owed_to_me';
```

**Files to modify:**
1. `src/components/ious/IOUForm.tsx` -- Add direction toggle, swap labels, hide reminders for "i_owe"
2. `src/hooks/useIOUs.tsx` -- Update `IOUInsert` interface to include `direction`; update `owedToMe`/`iOwe` filters; update notification message for reverse IOUs
3. `src/lib/offline/offlineDataLayer.ts` -- Add `direction` to `IOUInsertOffline` and `createIOUOfflineFirst`
4. `src/lib/offline/db.ts` -- Add `direction` to `LocalIOU` interface
5. `src/components/ious/IOUCard.tsx` -- Adjust display name logic based on direction
6. `src/pages/IOUDetail.tsx` -- Adjust creditor/debtor display based on direction
7. `supabase/functions/send-iou-reminders/index.ts` -- Add filter to skip `direction = 'i_owe'` IOUs
8. `src/lib/offline/dataSync.ts` -- Include `direction` in sync logic

**Filter logic change in `useIOUs.tsx`:**
- `owedToMe`: IOUs where (`creditor_id = me` AND `direction = 'owed_to_me'`) OR (`direction = 'i_owe'` AND debtor matches me -- meaning someone else said they owe me)
- `iOwe`: IOUs where (`creditor_id = me` AND `direction = 'i_owe'`) OR (debtor matches me AND `direction = 'owed_to_me'`)

**Notification on reverse IOU creation:**
- Send push to the other person's phone suffix with message: "Debt logged: [creator_name] says they owe you [amount]"
- Deep links to the IOU detail page so the creditor can see/verify it
