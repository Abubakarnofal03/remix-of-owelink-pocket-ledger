

## Plan: Full Bill Visibility for All Participants

### Problem
The `bill_participants` table RLS policy "Participants can view own participation" only lets a participant see **their own** row. So when friend 1 opens the bill detail, they only see themselves — not friends 2, 3, 4, or the creator's share.

### Root Cause
Missing RLS policy. Need a policy that says: "If you are a participant of bill X, you can see ALL participants of bill X."

### Changes

**1. Database Migration — New RLS policy on `bill_participants`**

Add a SELECT policy:
```sql
CREATE POLICY "Participants can view all bill members"
  ON public.bill_participants
  FOR SELECT
  USING (is_bill_participant(bill_id));
```

This uses the existing `is_bill_participant()` security definer function — if you're in the bill, you see everyone in the bill. No recursion risk since the function is `SECURITY DEFINER`.

**2. No UI changes needed**

The `BillDetail.tsx` page already:
- Shows all participants with owed/paid/remaining amounts (lines 837-986)
- Gates edit controls behind `isCreator` checks (status dropdown, edit amount, remove, record payment, send reminder)
- Lets non-creators file disputes and post to the notice board
- Shows the receipt/invoice to everyone

The only thing blocking participants from seeing the full picture is the missing RLS policy.

### What participants will see (read-only)
- All member names, phone numbers, avatars
- Each member's owed amount, paid amount, remaining amount
- Individual progress bars
- Bill total, collected amount, remaining amount, due date
- Receipt/invoice attachment
- Notice board and disputes

### What participants cannot do (unchanged)
- Edit bill title/description/total/due date
- Change any participant's status
- Record payments
- Add/remove participants
- Send reminders
- Archive/delete the bill

