

## Plan: Add Optional Invoice/Receipt Upload to Bills

### Decision: Add `receipt_url` column to `bills` table

Using the existing `invoices` table would be wasteful — it's a completely different entity with unrelated fields (invoice_number, client_phone_number, etc.). The most efficient approach is a single nullable `text` column on `bills` plus the already-existing `receipts` storage bucket.

### Technical Details

**Database Migration:**
- Add `receipt_url text NULL` to `bills` table — zero storage cost when unused (nullable text = no bytes for NULL rows)

**Storage:**
- Reuse existing `receipts` bucket (already public) — no new bucket needed

**Code Changes:**

1. **`src/components/bills/BillForm.tsx`** — Add optional file upload field after the Description section:
   - File input accepting image/* and application/pdf
   - Preview thumbnail when image selected
   - Upload to `receipts` bucket on submit, store URL in `receipt_url`
   - Compress images before upload using existing `src/lib/imageCompression.ts`

2. **`src/hooks/useBills.tsx`** — Add `receipt_url` to `BillInsert` interface and pass through in create/update mutations

3. **`src/lib/offline/db.ts`** — Add `receipt_url` to `LocalBill` interface

4. **`src/lib/offline/offlineDataLayer.ts`** — Pass `receipt_url` through in `createBillOfflineFirst`

5. **`src/pages/BillDetail.tsx`** — Display receipt image/link when `receipt_url` exists (clickable thumbnail that opens full image)

6. **`src/lib/offline/dataSync.ts`** — Include `receipt_url` in sync column projection

### Steps
1. Run migration: `ALTER TABLE bills ADD COLUMN receipt_url text NULL`
2. Update Bill interfaces and offline DB schema to include `receipt_url`
3. Add file upload UI to BillForm with image compression
4. Upload file to `receipts` bucket on bill creation, save URL
5. Display receipt in BillDetail page

