-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view bills they participate in" ON public.bills;
DROP POLICY IF EXISTS "View participants of accessible bills" ON public.bill_participants;
DROP POLICY IF EXISTS "Bill creators can manage participants" ON public.bill_participants;

-- Create a security definer function to check bill creator without RLS
CREATE OR REPLACE FUNCTION public.is_bill_creator(bill_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bills 
    WHERE id = bill_id AND creator_id = auth.uid()
  );
$$;

-- Create a security definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_bill_participant(bill_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bill_participants 
    WHERE bill_participants.bill_id = $1 
    AND (user_id = auth.uid() OR phone_number = get_user_phone(auth.uid()))
  );
$$;

-- Recreate bill_participants policies using the security definer function
CREATE POLICY "Bill creators can manage participants" 
ON public.bill_participants 
FOR ALL 
USING (is_bill_creator(bill_id));

CREATE POLICY "Participants can view own participation" 
ON public.bill_participants 
FOR SELECT 
USING (user_id = auth.uid() OR phone_number = get_user_phone(auth.uid()));

-- Recreate bills policy using the security definer function
CREATE POLICY "Users can view bills they participate in" 
ON public.bills 
FOR SELECT 
USING (deleted_at IS NULL AND is_bill_participant(id));