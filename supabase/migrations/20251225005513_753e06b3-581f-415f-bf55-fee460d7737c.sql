-- Update RLS policies so soft-deleted items are still visible to participants/debtors
-- but hidden from creators/creditors

-- Bills: Participants should ALWAYS see bills they're part of (even if creator deleted)
DROP POLICY IF EXISTS "Users can view bills they participate in" ON public.bills;
CREATE POLICY "Users can view bills they participate in"
ON public.bills
FOR SELECT
USING (is_bill_participant(id));

-- IOUs: Debtors should ALWAYS see IOUs where they owe (even if creditor deleted)
DROP POLICY IF EXISTS "View IOUs as debtor" ON public.ious;
CREATE POLICY "View IOUs as debtor"
ON public.ious
FOR SELECT
USING (
  (debtor_user_id = auth.uid()) 
  OR (COALESCE(debtor_phone_suffix, "right"(regexp_replace(debtor_phone_number, '[^0-9]'::text, ''::text, 'g'::text), 10)) = get_user_phone_suffix(auth.uid()))
);