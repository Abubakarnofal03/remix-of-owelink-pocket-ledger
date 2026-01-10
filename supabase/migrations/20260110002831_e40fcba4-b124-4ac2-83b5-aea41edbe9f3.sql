-- Create expense_buckets table
CREATE TABLE public.expense_buckets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add bucket_id to expenses table
ALTER TABLE public.expenses ADD COLUMN bucket_id UUID REFERENCES public.expense_buckets(id) ON DELETE SET NULL;

-- Enable RLS on expense_buckets
ALTER TABLE public.expense_buckets ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_buckets
CREATE POLICY "Users can CRUD own buckets"
ON public.expense_buckets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_expenses_bucket_id ON public.expenses(bucket_id);
CREATE INDEX idx_expense_buckets_user_id ON public.expense_buckets(user_id);

-- Add updated_at trigger for expense_buckets
CREATE TRIGGER update_expense_buckets_updated_at
  BEFORE UPDATE ON public.expense_buckets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();