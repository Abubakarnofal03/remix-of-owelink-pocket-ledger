-- Fix phone-format mismatches by using phone_suffix in access checks and linking

-- 1) Update helper function used by Bills RLS
CREATE OR REPLACE FUNCTION public.is_bill_participant(bill_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.bill_participants bp
    WHERE bp.bill_id = $1
      AND (
        bp.user_id = auth.uid()
        OR COALESCE(bp.phone_suffix, RIGHT(regexp_replace(bp.phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
      )
  );
$function$;

-- 2) Update Bill Participants SELECT policy to use phone_suffix
DROP POLICY IF EXISTS "Participants can view own participation" ON public.bill_participants;
CREATE POLICY "Participants can view own participation"
ON public.bill_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR COALESCE(phone_suffix, RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
);

-- 3) Update IOUs debtor SELECT policy to use debtor_phone_suffix
DROP POLICY IF EXISTS "View IOUs as debtor" ON public.ious;
CREATE POLICY "View IOUs as debtor"
ON public.ious
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    debtor_user_id = auth.uid()
    OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
  )
);

-- 4) Update Invoices client SELECT policy to use suffix match
DROP POLICY IF EXISTS "View invoices as client" ON public.invoices;
CREATE POLICY "View invoices as client"
ON public.invoices
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    client_user_id = auth.uid()
    OR RIGHT(regexp_replace(client_phone_number, '[^0-9]', '', 'g'), 10) = public.get_user_phone_suffix(auth.uid())
  )
);

-- 5) Backfill links based on phone_suffix (safe default; relies on suffix equality)
UPDATE public.bill_participants bp
SET user_id = p.user_id
FROM public.profiles p
WHERE bp.user_id IS NULL
  AND COALESCE(bp.phone_suffix, RIGHT(regexp_replace(bp.phone_number, '[^0-9]', '', 'g'), 10)) = p.phone_suffix;

UPDATE public.ious i
SET debtor_user_id = p.user_id
FROM public.profiles p
WHERE i.debtor_user_id IS NULL
  AND COALESCE(i.debtor_phone_suffix, RIGHT(regexp_replace(i.debtor_phone_number, '[^0-9]', '', 'g'), 10)) = p.phone_suffix;

UPDATE public.invoices inv
SET client_user_id = p.user_id
FROM public.profiles p
WHERE inv.client_user_id IS NULL
  AND RIGHT(regexp_replace(inv.client_phone_number, '[^0-9]', '', 'g'), 10) = p.phone_suffix;

UPDATE public.contacts c
SET linked_profile_id = p.id
FROM public.profiles p
WHERE c.linked_profile_id IS NULL
  AND COALESCE(c.phone_suffix, RIGHT(regexp_replace(c.phone_number, '[^0-9]', '', 'g'), 10)) = p.phone_suffix;
