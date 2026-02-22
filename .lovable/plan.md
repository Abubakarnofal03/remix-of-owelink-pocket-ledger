

# Bulk Settlement Feature for Grouped IOUs

## Overview
Add a "Settle" button in each person's group header in the Owes list. When tapped, the user enters a lump-sum amount (e.g., 7000), and the system automatically distributes it across that person's pending IOUs (oldest first), then shows a confirmation dialog with the breakdown before applying.

## How It Works

1. User taps "Settle" button on a person's group card
2. A dialog opens asking "How much did [Person] pay?"
3. User enters the amount (e.g., 7000)
4. The system calculates allocation across pending IOUs (oldest first, fully paying smaller ones before moving to the next):
   - IOU 1 (5000) -> fully paid (5000)
   - IOU 3 (1000) -> fully paid (1000)
   - IOU 2 (4000) -> partially paid (1000 of 4000)
5. User sees a preview breakdown and confirms
6. All IOUs are updated in one go

## Files to Change

**New file: `src/components/ious/BulkSettlementDialog.tsx`**
- Dialog with amount input field
- After entering amount, shows allocation preview table:
  - Each IOU description, original amount, amount being applied, new remaining
  - IOUs marked as "Fully Paid" or "Partial" 
- Confirm and Cancel buttons
- Uses the `updateIOUOfflineFirst` function for each IOU

**Modified: `src/components/ious/GroupedIOUList.tsx`**
- Add a "Settle" button (with a Banknote icon) in the group header actions area (next to WhatsApp, Add, View Contact buttons)
- Only show for creditor view (`isCreditor`) when there are pending IOUs
- Opens `BulkSettlementDialog` with the group's pending IOUs

**Modified: `src/hooks/useIOUs.tsx`**
- Add a `bulkUpdatePayments` function that takes an array of `{ id, amount_paid, status }` updates
- Updates each IOU locally and triggers background sync

## Technical Details

### Allocation Algorithm (in BulkSettlementDialog)
```
function allocatePayment(pendingIOUs: IOU[], totalPayment: number):
  1. Sort IOUs by created_at ascending (oldest first)
  2. remaining = totalPayment
  3. For each IOU:
     - owed = iou.amount - iou.amount_paid
     - apply = min(remaining, owed)
     - allocation.push({ iou, apply, newPaid: iou.amount_paid + apply, fullyPaid: apply >= owed })
     - remaining -= apply
     - if remaining <= 0, break
  4. Return allocations + any leftover
```

### Validation
- Amount must be > 0
- Amount must not exceed total remaining across all pending IOUs
- Show warning if amount exceeds total (excess cannot be applied)

### UI Flow
The dialog has two steps:
1. **Input step**: Amount field + "Calculate" button
2. **Preview step**: Table showing allocation per IOU + "Confirm Settlement" button

