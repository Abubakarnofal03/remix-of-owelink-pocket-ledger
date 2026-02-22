
-- Add is_pinned to bills table
ALTER TABLE public.bills ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add is_pinned to ious table
ALTER TABLE public.ious ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;
