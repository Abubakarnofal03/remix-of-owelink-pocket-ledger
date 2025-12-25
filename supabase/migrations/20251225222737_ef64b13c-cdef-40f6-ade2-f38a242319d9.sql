-- Create iou_payment_requests table for debtors to request payment confirmation
CREATE TABLE public.iou_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iou_id UUID NOT NULL REFERENCES public.ious(id) ON DELETE CASCADE,
  requester_phone_suffix TEXT NOT NULL,
  amount_claimed NUMERIC NOT NULL DEFAULT 0,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  creator_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.iou_payment_requests ENABLE ROW LEVEL SECURITY;

-- Creditors (IOU creators) can view all requests for their IOUs
CREATE POLICY "Creditor can view requests" ON public.iou_payment_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM ious WHERE id = iou_id AND creditor_id = auth.uid())
  );

-- Debtors can view their own requests
CREATE POLICY "Debtor can view own requests" ON public.iou_payment_requests
  FOR SELECT USING (
    requester_phone_suffix = public.get_user_phone_suffix(auth.uid())
  );

-- Debtors can create requests for IOUs where they are the debtor
CREATE POLICY "Debtor can create requests" ON public.iou_payment_requests
  FOR INSERT WITH CHECK (
    requester_phone_suffix = public.get_user_phone_suffix(auth.uid())
    AND EXISTS (
      SELECT 1 FROM ious 
      WHERE id = iou_id 
      AND (
        debtor_user_id = auth.uid() 
        OR COALESCE(debtor_phone_suffix, right(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
      )
    )
  );

-- Creditors can update request status
CREATE POLICY "Creditor can update requests" ON public.iou_payment_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM ious WHERE id = iou_id AND creditor_id = auth.uid())
  );

-- Create trigger for updated_at
CREATE TRIGGER update_iou_payment_requests_updated_at
  BEFORE UPDATE ON public.iou_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();