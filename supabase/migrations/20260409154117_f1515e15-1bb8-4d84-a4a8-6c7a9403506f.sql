-- Migrate contact_status from text to text array for multi-select
ALTER TABLE public.leads 
  ADD COLUMN contact_statuses text[] NOT NULL DEFAULT '{niet_gebeld}'::text[];

-- Copy existing values
UPDATE public.leads SET contact_statuses = ARRAY[contact_status];

-- Drop old column
ALTER TABLE public.leads DROP COLUMN contact_status;