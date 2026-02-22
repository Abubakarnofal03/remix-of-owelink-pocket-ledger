-- Create expense_groups table
CREATE TABLE public.expense_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can CRUD own groups"
ON public.expense_groups FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE TRIGGER update_expense_groups_updated_at
BEFORE UPDATE ON public.expense_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create expense_group_members table
CREATE TABLE public.expense_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  phone_suffix TEXT,
  user_id UUID,
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_group_members ENABLE ROW LEVEL SECURITY;

-- Set phone_suffix trigger
CREATE TRIGGER set_group_member_phone_suffix
BEFORE INSERT OR UPDATE ON public.expense_group_members
FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();

-- Note: set_phone_suffix checks TG_TABLE_NAME, need a generic version
CREATE OR REPLACE FUNCTION public.set_generic_phone_suffix()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.phone_suffix := RIGHT(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), 10);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_group_member_phone_suffix ON public.expense_group_members;

CREATE TRIGGER set_group_member_phone_suffix
BEFORE INSERT OR UPDATE ON public.expense_group_members
FOR EACH ROW EXECUTE FUNCTION public.set_generic_phone_suffix();

-- Creator can manage members
CREATE POLICY "Group creator can manage members"
ON public.expense_group_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = expense_group_members.group_id AND creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = expense_group_members.group_id AND creator_id = auth.uid()
  )
);

-- Members can view their own group membership
CREATE POLICY "Members can view own groups"
ON public.expense_group_members FOR SELECT
USING (
  user_id = auth.uid()
  OR COALESCE(phone_suffix, RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid())
);

-- Members can view the group itself
CREATE POLICY "Members can view groups"
ON public.expense_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_group_members m
    WHERE m.group_id = expense_groups.id
    AND (
      m.user_id = auth.uid()
      OR COALESCE(m.phone_suffix, RIGHT(regexp_replace(m.phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid())
    )
  )
);

-- Create group_expenses table
CREATE TABLE public.group_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  paid_by_member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  split_type TEXT NOT NULL DEFAULT 'equal',
  split_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;

-- Creator can manage group expenses
CREATE POLICY "Group creator can manage expenses"
ON public.group_expenses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = group_expenses.group_id AND creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = group_expenses.group_id AND creator_id = auth.uid()
  )
);

-- Members can view group expenses
CREATE POLICY "Members can view group expenses"
ON public.group_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_group_members m
    WHERE m.group_id = group_expenses.group_id
    AND (
      m.user_id = auth.uid()
      OR COALESCE(m.phone_suffix, RIGHT(regexp_replace(m.phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid())
    )
  )
);

-- Members can create expenses in groups they belong to
CREATE POLICY "Members can create group expenses"
ON public.group_expenses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expense_group_members m
    WHERE m.group_id = group_expenses.group_id
    AND (
      m.user_id = auth.uid()
      OR COALESCE(m.phone_suffix, RIGHT(regexp_replace(m.phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid())
    )
  )
);