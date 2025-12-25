-- Fix RLS UPDATE policies for soft-delete to work properly
-- The issue is RESTRICTIVE policies without WITH CHECK clause

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Creditors can update IOUs" ON public.ious;
DROP POLICY IF EXISTS "Creators can update their bills" ON public.bills;

-- Recreate UPDATE policies as PERMISSIVE with proper USING and WITH CHECK
CREATE POLICY "Creditors can update IOUs"
ON public.ious
FOR UPDATE
USING (auth.uid() = creditor_id)
WITH CHECK (auth.uid() = creditor_id);

CREATE POLICY "Creators can update their bills"
ON public.bills
FOR UPDATE
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);