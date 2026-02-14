

## Issue 1: Contact Names Not Showing on Owes Page

**Problem**: When navigating back to the Owes list after creating an IOU, and every time the page loads, phone numbers flash first before contact names appear. This happens because `useContacts()` loads asynchronously (local IndexedDB + device contacts), while the IOU list renders immediately from cached data. The `GroupedIOUList` component calls `getContactName()` which depends on `contacts` array -- if contacts haven't loaded yet, it falls back to showing the raw phone number.

**Solution**: Cache a contact name lookup map that resolves instantly, and ensure the grouped list doesn't "flash" phone numbers while contacts load.

1. **Pre-cache contact names in GroupedIOUList**: Instead of depending on the async `useContacts()` hook for every render, build a stable name map from contacts and memoize it. Show skeleton/placeholder for the group header while contacts are still loading rather than showing phone numbers.

2. **Pass contacts loading state**: The `GroupedIOUList` already receives `loading` but only for IOUs. Add awareness of contacts loading state so it can show a proper loading skeleton instead of phone numbers.

3. **Stabilize contact resolution in IOUs page**: In `src/pages/IOUs.tsx`, the `getContactName` helper depends on `contacts` which changes as contacts load. Ensure the `GroupedIOUList` waits for contacts to be ready before rendering names, or shows a loading state.

**Technical changes**:
- `src/pages/IOUs.tsx`: Pass `contactsLoading` from `useContacts()` to `GroupedIOUList`
- `src/components/ious/GroupedIOUList.tsx`: Accept `contactsLoading` prop; show skeleton placeholders for names while contacts are loading instead of raw phone numbers

---

## Issue 2: Mini Calculator for Bills, Owes, and Expenses

**What**: A small calculator widget accessible via a button click in all three creation forms (Bills, Owes, Expenses). It opens as a popover/dialog, lets the user do basic arithmetic, and inserts the result into the amount field.

**Design**:
- A reusable `MiniCalculator` component rendered as a popover/sheet
- Supports basic operations: +, -, x, / and =
- Displays a running expression and result
- Has an "Insert" button that sends the calculated value back to the amount field
- Triggered by a calculator icon button next to each amount input

**Technical changes**:

1. **New component `src/components/ui/MiniCalculator.tsx`**:
   - Calculator UI with number pad (0-9), operators (+, -, x, /), decimal point, clear, backspace, and equals
   - Wrapped in a `Popover` (or `Drawer` on mobile) for inline use
   - Accepts an `onInsert(value: number)` callback
   - Shows expression string and computed result in real-time

2. **Integrate into `src/components/ious/IOUForm.tsx`**:
   - Add calculator button next to the amount input
   - On insert, set the amount state

3. **Integrate into `src/components/bills/BillForm.tsx`**:
   - Add calculator button next to the total amount input
   - On insert, set the amount state

4. **Integrate into `src/pages/Expenses.tsx`**:
   - Add calculator button next to the expense amount input
   - On insert, set the amount state

