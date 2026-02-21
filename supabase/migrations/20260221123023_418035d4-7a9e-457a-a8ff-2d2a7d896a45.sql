
-- Junction table for many-to-many product <-> category
CREATE TABLE public.product_category_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- Enable RLS
ALTER TABLE public.product_category_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users full access" ON public.product_category_links FOR ALL USING (true) WITH CHECK (true);

-- Migrate existing category_id data
INSERT INTO public.product_category_links (product_id, category_id)
SELECT id, category_id FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Index for performance
CREATE INDEX idx_product_category_links_product ON public.product_category_links(product_id);
CREATE INDEX idx_product_category_links_category ON public.product_category_links(category_id);
