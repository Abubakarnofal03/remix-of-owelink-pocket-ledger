

## Plan: Include Me Default, Dispute Identity & Full Dispute Flow

### 1. Default "Include Me" to true in BillForm

**File**: `src/components/bills/BillForm.tsx` line 94

Change `useState(false)` to `useState(true)` for `includeMe`.

### 2. Show who filed the dispute in DisputeCard

**File**: `src/components/disputes/DisputeCard.tsx`

Add a new prop `disputerName?: string` and display it (e.g., "Filed by **Name**") below the status row. The parent components (BillDetail, IOUDetail) will resolve the name from `dispute.disputed_by_phone_suffix` using existing `getContactNameBySuffix` helpers and pass it down.

**Files**: `src/pages/BillDetail.tsx`, `src/pages/IOUDetail.tsx` — pass `disputerName` prop to each `<DisputeCard>`.

### 3. Complete dispute functionality in BillDetail

Currently, `BillDetail` renders `DisputeCard` but unlike `IOUDetail`, the cards are **not clickable** for the creator to respond. Fix:

**File**: `src/pages/BillDetail.tsx` (lines 1093-1099)

- Wrap each `DisputeCard` in a clickable container (like IOUDetail does) so that when `isCreator && dispute.status === 'open'`, clicking opens `DisputeResponseDialog` via `setSelectedDispute(dispute)`.

### 4. Handle dispute acceptance side-effects

When the creator **accepts** a dispute with a `proposed_amount`, the participant's `amount_owed` should be updated to reflect the new amount. 

**File**: `src/pages/BillDetail.tsx` — in the `onAccept` handler of `DisputeResponseDialog`:
- After `updateDispute(...)`, if `selectedDispute.proposed_amount` exists:
  - Find the participant by `disputed_by_phone_suffix`
  - Update their `amount_owed` to `proposed_amount` via `updateBillParticipantOfflineFirst`
  - Update local bill state
  - Recalculate bill total if needed
  - Sync

**File**: `src/pages/IOUDetail.tsx` — similarly, on accept with proposed_amount, update the IOU amount.

### Files to Change
1. `src/components/bills/BillForm.tsx` — line 94: `false` → `true`
2. `src/components/disputes/DisputeCard.tsx` — add `disputerName` prop and display
3. `src/pages/BillDetail.tsx` — make dispute cards clickable for creator, handle accept side-effects
4. `src/pages/IOUDetail.tsx` — pass `disputerName`, handle accept side-effects

