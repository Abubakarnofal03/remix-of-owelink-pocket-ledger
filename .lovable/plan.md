
# Plan: UI Improvements and New Features

## 1. Fix Quick Action Buttons (Home Page)

The current buttons have overly complex styling with glowing borders and gradients that look cluttered. Redesign them to be cleaner, more minimal cards with:
- Simple, solid icon containers with subtle backgrounds
- Clean typography without excessive glow/shadow effects
- Reduced border complexity -- single subtle border instead of double glowing borders

**File**: `src/pages/Index.tsx` (lines 156-187)

---

## 2. Notice Board - Move to Top + Sticky Note UI

Move the `<NoticeBoard>` component from after the Participants section (line 945) to right after the Header section (after line 713) in `BillDetail.tsx`.

Redesign the notice display in `NoticeBoard.tsx` to look like sticky notes on a board:
- Replace the current list layout with a flex-wrap grid of "sticky note" cards
- Each card gets a pastel/colored background (using the existing `notice.color`)
- Cards have slightly rotated angles (random small rotations like -2deg, 1deg, -1deg) for a realistic pinned-on-board look
- Card sizes adapt to content length (short text = smaller card, long text = larger)
- Add a subtle pin/pushpin icon at the top of each note
- The board background gets a cork-board-like texture (warm beige/brown gradient)

**File**: `src/components/bills/NoticeBoard.tsx`

---

## 3. Bill Debts Appearing in Owes Section

Show unpaid bill participant amounts in the Owes (IOU) section, distinguished with a badge.

**Approach**:
- In `src/hooks/useBills.tsx`, export a helper or add a function to get bill debts owed to the current user
- In `src/pages/IOUs.tsx` and `src/components/ious/GroupedIOUList.tsx`, merge bill-sourced debts into the grouped list
- Create a new type/flag on the IOU-like object to mark it as `source: 'bill'`
- In `IOUCard.tsx`, when the item is bill-sourced, show a distinctive badge (e.g., a "From Bill" badge with a Receipt icon in a unique color like indigo/purple) and slightly different card border/accent color

**Files**: `src/pages/IOUs.tsx`, `src/components/ious/GroupedIOUList.tsx`, `src/components/ious/IOUCard.tsx`, `src/hooks/useBills.tsx`

---

## 4. Contact View Button per Person Group

Add a small "View Contact" button in each person's group header in the `GroupedIOUList.tsx`.

- Add a `User` icon button next to the existing Plus and WhatsApp buttons
- On click, find the contact by phone number and navigate to `/contacts/{contactId}`
- If no matching contact exists, the button is hidden

**File**: `src/components/ious/GroupedIOUList.tsx`

---

## 5. Swipeable IOU Detail with Person Separator Cards

Implement horizontal swipe navigation between IOUs on the `IOUDetail.tsx` page.

**Approach**:
- Use `embla-carousel-react` (already installed) to create a swipeable container
- On mount, get the full ordered list of IOUs grouped by person from the `useIOUs` hook
- Build a flat list of slides: IOUs grouped by person, with separator cards between groups
- Separator cards display "IOUs for [Person Name]" as a transition indicator
- Add a dot/progress indicator at the top showing current position
- Swipe left = next IOU, swipe right = previous IOU
- When reaching the last IOU of a person, the next slide is the separator card, then the next person's IOUs begin
- Back-swipe mirrors the same logic

**Top indicator**: A thin bar with dots or a linear progress showing `current / total` IOUs, with the person's name displayed.

**Files**: 
- `src/pages/IOUDetail.tsx` (major restructure to wrap content in embla carousel)
- May need a new `src/components/ious/IOUSwipeContainer.tsx` wrapper component

---

## Technical Details

### File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Simplify Quick Action button styling |
| `src/components/bills/NoticeBoard.tsx` | Redesign as sticky-note board UI |
| `src/pages/BillDetail.tsx` | Move NoticeBoard above Participants |
| `src/pages/IOUs.tsx` | Import and merge bill debts into owes list |
| `src/hooks/useBills.tsx` | Export bill debts helper for current user |
| `src/components/ious/GroupedIOUList.tsx` | Add contact view button per group |
| `src/components/ious/IOUCard.tsx` | Add "From Bill" badge for bill-sourced items |
| `src/pages/IOUDetail.tsx` | Wrap in embla carousel for swipe navigation |

### Dependencies
- `embla-carousel-react` -- already installed, used for swipe navigation
- No new packages needed
