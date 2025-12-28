-- Add reminder fields to ious table
ALTER TABLE public.ious 
ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_interval_days integer,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamp with time zone;