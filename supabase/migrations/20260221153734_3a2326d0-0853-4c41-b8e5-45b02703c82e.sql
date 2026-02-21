-- Create storage bucket for room photos
INSERT INTO storage.buckets (id, name, public) VALUES ('room-photos', 'room-photos', true);

-- Allow authenticated users to manage room photos
CREATE POLICY "Auth users can upload room photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'room-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can view room photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-photos');

CREATE POLICY "Auth users can delete room photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'room-photos' AND auth.role() = 'authenticated');

-- Create table to store room photos linked to jobs
CREATE TABLE public.job_room_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_room_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users full access"
ON public.job_room_photos FOR ALL
USING (true)
WITH CHECK (true);