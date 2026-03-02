
CREATE TABLE public.iou_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iou_id uuid NOT NULL,
  author_phone_suffix text NOT NULL,
  message text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iou_notices ENABLE ROW LEVEL SECURITY;

-- RLS: creditor can manage notices
CREATE POLICY "IOU creditor can manage notices" ON public.iou_notices
  FOR ALL USING (EXISTS (
    SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id AND ious.creditor_id = auth.uid()
  ));

-- RLS: debtor can view notices
CREATE POLICY "IOU debtor can view notices" ON public.iou_notices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id
      AND (debtor_user_id = auth.uid() OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid()))
    )
  );

-- RLS: debtor can create notices
CREATE POLICY "IOU debtor can create notices" ON public.iou_notices
  FOR INSERT WITH CHECK (
    author_phone_suffix = get_user_phone_suffix(auth.uid())
    AND EXISTS (
      SELECT 1 FROM ious WHERE ious.id = iou_notices.iou_id
      AND (debtor_user_id = auth.uid() OR COALESCE(debtor_phone_suffix, RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10)) = get_user_phone_suffix(auth.uid()))
    )
  );

-- RLS: author can delete own notices
CREATE POLICY "Author can delete own IOU notices" ON public.iou_notices
  FOR DELETE USING (author_phone_suffix = get_user_phone_suffix(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.iou_notices;
