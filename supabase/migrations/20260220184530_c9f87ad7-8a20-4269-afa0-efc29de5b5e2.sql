
-- Storage bucket for delivery photos and company assets
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-photos', 'delivery-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Auth users can upload delivery photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('delivery-photos', 'company-assets'));
CREATE POLICY "Auth users can view delivery photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('delivery-photos', 'company-assets'));
CREATE POLICY "Auth users can update delivery photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('delivery-photos', 'company-assets'));
CREATE POLICY "Auth users can delete delivery photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('delivery-photos', 'company-assets'));
CREATE POLICY "Public can view delivery photos" ON storage.objects FOR SELECT TO anon USING (bucket_id IN ('delivery-photos', 'company-assets'));
