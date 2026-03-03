
-- Create leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  rooms jsonb DEFAULT '[]'::jsonb,
  advised_price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'nieuw',
  job_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publiek kan leads aanmaken"
  ON public.leads FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated kan leads beheren"
  ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public SELECT for products/categories (for marketing website)
CREATE POLICY "Publiek kan producten lezen"
  ON public.products FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Publiek kan categorieen lezen"
  ON public.product_categories FOR SELECT TO anon USING (true);

CREATE POLICY "Publiek kan category links lezen"
  ON public.product_category_links FOR SELECT TO anon USING (true);
