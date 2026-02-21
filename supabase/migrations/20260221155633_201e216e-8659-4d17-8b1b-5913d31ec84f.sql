-- Add room_name column to job_items so we can group products by room
ALTER TABLE public.job_items ADD COLUMN room_name TEXT;
