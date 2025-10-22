-- Add attachments column to service requests for storing file metadata
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.service_requests.attachments IS 'Array of attachment metadata objects: { name, type, size, url, path }';
