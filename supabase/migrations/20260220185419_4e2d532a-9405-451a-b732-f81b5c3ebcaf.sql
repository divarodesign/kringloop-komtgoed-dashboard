
-- Add icon column to products and categories
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS icon TEXT;
