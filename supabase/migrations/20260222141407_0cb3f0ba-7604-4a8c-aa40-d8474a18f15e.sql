
-- Add pdf_url column to deliveries table
ALTER TABLE public.deliveries ADD COLUMN pdf_url text;

-- Create delivery-pdfs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-pdfs', 'delivery-pdfs', true);

-- Allow authenticated users to upload to delivery-pdfs
CREATE POLICY "Auth users can upload delivery pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-pdfs' AND auth.role() = 'authenticated');

-- Allow public read access to delivery-pdfs
CREATE POLICY "Public read access delivery pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-pdfs');

-- Allow authenticated users to delete delivery pdfs
CREATE POLICY "Auth users can delete delivery pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'delivery-pdfs' AND auth.role() = 'authenticated');
