
-- Fix: Allow members to see ALL members in groups they belong to (not just themselves)
DROP POLICY IF EXISTS "Members can view own groups" ON public.expense_group_members;

CREATE POLICY "Members can view group members"
ON public.expense_group_members
FOR SELECT
USING (
  public.is_expense_group_member(group_id, auth.uid())
);

-- Fix: Allow members to insert group expenses using security definer function
DROP POLICY IF EXISTS "Members can create group expenses" ON public.group_expenses;

CREATE POLICY "Members can create group expenses"
ON public.group_expenses
FOR INSERT
WITH CHECK (
  public.is_expense_group_member(group_id, auth.uid())
);

-- Also fix SELECT for group_expenses to use the security definer function
DROP POLICY IF EXISTS "Members can view group expenses" ON public.group_expenses;

CREATE POLICY "Members can view group expenses"
ON public.group_expenses
FOR SELECT
USING (
  public.is_expense_group_member(group_id, auth.uid())
);
