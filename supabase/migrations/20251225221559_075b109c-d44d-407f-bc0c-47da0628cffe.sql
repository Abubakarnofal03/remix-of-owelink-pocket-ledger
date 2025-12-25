-- Create storage bucket for receipts (public for viewing, with RLS for uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create payment_requests table for debtors to request status changes
CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.bill_participants(id) ON DELETE CASCADE,
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
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Bill creator can view all requests for their bills
CREATE POLICY "Bill creator can view requests"
ON public.payment_requests
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.bills WHERE id = bill_id AND creator_id = auth.uid())
);

-- Participants can view their own requests
CREATE POLICY "Participant can view own requests"
ON public.payment_requests
FOR SELECT
USING (
  requester_phone_suffix = public.get_user_phone_suffix(auth.uid())
);

-- Participants can create requests for bills they're part of
CREATE POLICY "Participant can create requests"
ON public.payment_requests
FOR INSERT
WITH CHECK (
  requester_phone_suffix = public.get_user_phone_suffix(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.bill_participants bp
    WHERE bp.id = participant_id
    AND bp.bill_id = bill_id
    AND (bp.phone_suffix = requester_phone_suffix OR RIGHT(regexp_replace(bp.phone_number, '[^0-9]', '', 'g'), 10) = requester_phone_suffix)
  )
);

-- Bill creator can update request status (approve/reject)
CREATE POLICY "Bill creator can update requests"
ON public.payment_requests
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.bills WHERE id = bill_id AND creator_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');