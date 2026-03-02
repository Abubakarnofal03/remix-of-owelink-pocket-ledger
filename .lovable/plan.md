

## Plan: Notifications, Reminder Fix, Notice Board & Disputes for IOUs

This is a large multi-part task. Here's a breakdown of everything needed.

---

### 1. Fix Reminder Toggle Not Persisting

**Root cause**: In `src/lib/offline/dataSync.ts` line 127-151, `syncIOUsFromServer` does NOT map `reminder_enabled`, `reminder_interval_days`, `last_reminder_sent_at`, or `is_pinned` from server data to `LocalIOU` objects. So every sync overwrites these fields with `undefined`, resetting the toggle.

**Fix in `src/lib/offline/dataSync.ts`**: Add the missing fields to the IOU mapping:
```typescript
reminder_enabled: (iou as any).reminder_enabled || false,
reminder_interval_days: (iou as any).reminder_interval_days || null,
last_reminder_sent_at: (iou as any).last_reminder_sent_at || null,
is_pinned: (iou as any).is_pinned || false,
```

The reminder interval logic in the edge functions (`send-bill-reminders`, `send-iou-reminders`) already correctly checks `daysSinceLastReminder < intervalDays`, so the "every N days" logic is already working. The issue was just the toggle resetting due to missing sync fields.

---

### 2. Add Notifications for Group Activities

**File**: `src/hooks/useExpenseGroups.tsx`

Add push notifications when:
- **Member added** to a group: notify all existing group members
- **Member removed**: notify the removed member
- **Expense added**: notify all group members except the one who added it
- **Expense deleted**: notify all group members

This requires fetching group member phone suffixes and calling `sendPushNotification`. Import and use the existing `sendPushNotification` and `getPhoneSuffix` utilities.

---

### 3. Add Notifications for Dispute Events

**Files**: `src/pages/BillDetail.tsx`, `src/pages/IOUDetail.tsx`

- **Dispute opened**: notify the bill creator / IOU creditor (already partly done via the disputes hook, but no push notification is sent)
- **Dispute accepted/rejected**: notify the disputer

For bills, also notify all other bill participants about the dispute event.

Add `sendPushNotification` calls in:
- `DisputeDialog` onSubmit handlers (in BillDetail and IOUDetail)
- `DisputeResponseDialog` onAccept/onReject handlers

---

### 4. Add Notifications for Notice Board Activity

**File**: `src/components/bills/NoticeBoard.tsx`

The notice board already sends push notifications when a notice is added. Verify this is working and extend it to the IOUs module (see section 6).

---

### 5. Create `iou_notices` Database Table

**New migration**: Create `iou_notices` table mirroring `bill_notices`:

```sql
CREATE TABLE public.iou_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iou_id uuid NOT NULL,
  author_phone_suffix text NOT NULL,
  message text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iou_notices ENABLE ROW LEVEL SECURITY;

-- RLS: creditor can manage notices
CREATE POLICY "IOU creditor can manage notices" ON public.iou_notices
  FOR ALL USING (EXISTS (
    SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id AND ious.creditor_id = auth.uid()
  ));

-- RLS: debtor can view and create notices
CREATE POLICY "IOU debtor can view notices" ON public.iou_notices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id
      AND (debtor_user_id = auth.uid() OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid()))
    )
  );

CREATE POLICY "IOU debtor can create notices" ON public.iou_notices
  FOR INSERT WITH CHECK (
    author_phone_suffix = get_user_phone_suffix(auth.uid())
    AND EXISTS (
      SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id
      AND (debtor_user_id = auth.uid() OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid()))
    )
  );

CREATE POLICY "Author can delete own IOU notices" ON public.iou_notices
  FOR DELETE USING (author_phone_suffix = get_user_phone_suffix(auth.uid()));
```

---

### 6. Implement Notice Board for IOUs

**New component**: `src/components/ious/IOUNoticeBoard.tsx` — adapt `NoticeBoard.tsx` for IOUs, reading from `iou_notices` table instead of `bill_notices`.

**Update IndexedDB schema** in `src/lib/offline/db.ts`:
- Add `LocalIOUNotice` interface
- Add `iouNotices` table to Dexie schema (bump version)

**Add to IOUDetail page** (`src/pages/IOUDetail.tsx`):
- Import and render `IOUNoticeBoard` component
- Pass creditor/debtor phone suffixes for notifications

---

### 7. Add Dispute Support for IOUs (Already Exists)

IOUDetail already has dispute filing, viewing, and response dialogs. The missing piece is just **push notifications** (covered in section 3).

---

### Files to Change

1. `src/lib/offline/dataSync.ts` — Fix IOU sync missing reminder fields
2. `src/hooks/useExpenseGroups.tsx` — Add push notifications for group activities
3. `src/pages/BillDetail.tsx` — Add push notifications for dispute events
4. `src/pages/IOUDetail.tsx` — Add push notifications for dispute events, add IOUNoticeBoard
5. `src/lib/offline/db.ts` — Add `LocalIOUNotice` interface and table, bump schema version
6. `src/components/ious/IOUNoticeBoard.tsx` — New component (adapted from NoticeBoard)
7. **Database migration** — Create `iou_notices` table with RLS policies

