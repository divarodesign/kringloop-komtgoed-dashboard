SELECT cron.schedule(
  'sync-wefact-statuses',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ngndjbeltygurjcnlcxz.supabase.co/functions/v1/sync-wefact-statuses',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbmRqYmVsdHlndXJqY25sY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA4NDUsImV4cCI6MjA4NzE4Njg0NX0.fhGPHjNCQa0m9EcWmTNNfxr1U6oMPWelBKMuEdE1lKY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);