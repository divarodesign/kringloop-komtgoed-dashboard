
-- Convert contacted boolean to text contact_status
ALTER TABLE public.leads ADD COLUMN contact_status text NOT NULL DEFAULT 'niet_gebeld';

-- Migrate existing data
UPDATE public.leads SET contact_status = CASE WHEN contacted = true THEN 'gebeld' ELSE 'niet_gebeld' END;

-- Drop old column
ALTER TABLE public.leads DROP COLUMN contacted;
