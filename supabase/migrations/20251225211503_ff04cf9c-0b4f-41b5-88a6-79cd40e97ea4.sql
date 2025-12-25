-- Add reminder columns to bills table
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_interval_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;