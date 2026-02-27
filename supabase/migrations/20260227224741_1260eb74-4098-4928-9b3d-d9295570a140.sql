CREATE POLICY "Participants can view all bill members"
  ON public.bill_participants
  FOR SELECT
  TO authenticated
  USING (is_bill_participant(bill_id));