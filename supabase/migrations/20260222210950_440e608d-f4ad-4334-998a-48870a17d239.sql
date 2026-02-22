
-- Create a security definer function to check group membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_expense_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expense_group_members m
    WHERE m.group_id = _group_id
      AND (
        m.user_id = _user_id
        OR COALESCE(m.phone_suffix, RIGHT(regexp_replace(m.phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(_user_id)
      )
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Members can view groups" ON public.expense_groups;

-- Recreate using the security definer function
CREATE POLICY "Members can view groups"
ON public.expense_groups
FOR SELECT
USING (public.is_expense_group_member(id, auth.uid()));
