
-- Create disputes table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  disputed_by_phone_suffix TEXT NOT NULL,
  disputed_by_user_id UUID,
  reason TEXT NOT NULL,
  proposed_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  creator_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Disputant can create disputes
CREATE POLICY "Disputant can create disputes"
ON public.disputes
FOR INSERT
WITH CHECK (
  disputed_by_phone_suffix = get_user_phone_suffix(auth.uid())
);

-- Disputant can view own disputes
CREATE POLICY "Disputant can view own disputes"
ON public.disputes
FOR SELECT
USING (
  disputed_by_phone_suffix = get_user_phone_suffix(auth.uid())
);

-- Entity creator can view disputes on their bills/IOUs
CREATE POLICY "Entity creator can view disputes"
ON public.disputes
FOR SELECT
USING (
  (entity_type = 'iou' AND entity_id IN (SELECT id FROM ious WHERE creditor_id = auth.uid()))
  OR
  (entity_type = 'bill' AND entity_id IN (SELECT id FROM bills WHERE creator_id = auth.uid()))
);

-- Entity creator can update disputes (accept/reject)
CREATE POLICY "Entity creator can update disputes"
ON public.disputes
FOR UPDATE
USING (
  (entity_type = 'iou' AND entity_id IN (SELECT id FROM ious WHERE creditor_id = auth.uid()))
  OR
  (entity_type = 'bill' AND entity_id IN (SELECT id FROM bills WHERE creator_id = auth.uid()))
);

-- Updated_at trigger
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
