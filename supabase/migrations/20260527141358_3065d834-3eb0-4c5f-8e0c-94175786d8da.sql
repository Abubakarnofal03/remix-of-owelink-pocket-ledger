
ALTER TABLE public.expense_group_members
  ADD COLUMN IF NOT EXISTS is_co_creator boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_expense_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_groups g WHERE g.id = _group_id AND g.creator_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.expense_group_members m
    WHERE m.group_id = _group_id
      AND m.is_co_creator = true
      AND (
        m.user_id = _user_id
        OR COALESCE(m.phone_suffix, RIGHT(regexp_replace(m.phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(_user_id)
      )
  );
$$;

DROP POLICY IF EXISTS "Group creator can manage members" ON public.expense_group_members;
CREATE POLICY "Group admins can manage members"
ON public.expense_group_members FOR ALL
USING (public.is_expense_group_admin(group_id, auth.uid()))
WITH CHECK (public.is_expense_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "Group creator can manage expenses" ON public.group_expenses;
CREATE POLICY "Group admins can manage expenses"
ON public.group_expenses FOR ALL
USING (public.is_expense_group_admin(group_id, auth.uid()))
WITH CHECK (public.is_expense_group_admin(group_id, auth.uid()));
