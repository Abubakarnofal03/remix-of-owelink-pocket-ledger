
-- Create recurring_schedules table
CREATE TABLE public.recurring_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bill', 'iou')),
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can CRUD own recurring schedules"
ON public.recurring_schedules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
