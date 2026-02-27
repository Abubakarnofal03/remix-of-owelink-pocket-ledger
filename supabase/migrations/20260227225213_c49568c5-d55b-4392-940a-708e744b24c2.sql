-- The existing INSERT policy on disputes is RESTRICTIVE, which means
-- it cannot grant access on its own. We need to drop it and recreate as PERMISSIVE.

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Disputant can create disputes" ON public.disputes;

-- Recreate as PERMISSIVE so it can actually grant INSERT access
CREATE POLICY "Disputant can create disputes"
  ON public.disputes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    disputed_by_phone_suffix = get_user_phone_suffix(auth.uid())
  );