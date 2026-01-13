-- Create bill_notices table for the notice board feature
CREATE TABLE public.bill_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  author_phone_suffix TEXT NOT NULL,
  message TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_notices ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_bill_notices_bill_id ON public.bill_notices(bill_id);

-- Policy: Bill creator can view all notices
CREATE POLICY "Bill creator can view notices"
ON public.bill_notices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE bills.id = bill_notices.bill_id
    AND bills.creator_id = auth.uid()
  )
);

-- Policy: Bill participants can view notices
CREATE POLICY "Bill participants can view notices"
ON public.bill_notices
FOR SELECT
USING (
  public.is_bill_participant(bill_id)
);

-- Policy: Bill creator can create notices
CREATE POLICY "Bill creator can create notices"
ON public.bill_notices
FOR INSERT
WITH CHECK (
  author_phone_suffix = public.get_user_phone_suffix(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.bills
    WHERE bills.id = bill_notices.bill_id
    AND bills.creator_id = auth.uid()
  )
);

-- Policy: Bill participants can create notices
CREATE POLICY "Bill participants can create notices"
ON public.bill_notices
FOR INSERT
WITH CHECK (
  author_phone_suffix = public.get_user_phone_suffix(auth.uid())
  AND public.is_bill_participant(bill_id)
);

-- Policy: Authors can delete their own notices
CREATE POLICY "Authors can delete own notices"
ON public.bill_notices
FOR DELETE
USING (
  author_phone_suffix = public.get_user_phone_suffix(auth.uid())
);

-- Policy: Bill creator can delete any notice
CREATE POLICY "Bill creator can delete any notice"
ON public.bill_notices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE bills.id = bill_notices.bill_id
    AND bills.creator_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_bill_notices_updated_at
BEFORE UPDATE ON public.bill_notices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();