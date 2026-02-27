CREATE POLICY "Debtors can update i_owe IOUs"
ON public.ious
FOR UPDATE
TO authenticated
USING (
  direction = 'i_owe'
  AND (
    debtor_user_id = auth.uid()
    OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
  )
)
WITH CHECK (
  direction = 'i_owe'
  AND (
    debtor_user_id = auth.uid()
    OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
  )
);