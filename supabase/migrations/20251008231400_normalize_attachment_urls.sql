-- Normalize attachment storage and URLs
-- 1) Add attachment_urls (text[]) to service_requests
-- 2) Backfill from existing attachments (jsonb: string | string[] | object[])
-- 3) Normalize hosts for local dev (host.docker.internal -> 127.0.0.1, localhost -> 127.0.0.1)
-- 4) Normalize applications.cv_url hosts as well

BEGIN;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS attachment_urls text[];

-- Backfill attachment_urls from attachments jsonb
WITH raw AS (
  SELECT
    id,
    CASE
      WHEN attachments IS NULL THEN NULL
      WHEN jsonb_typeof(attachments) = 'string' THEN ARRAY[trim(both '"' from attachments::text)]
      WHEN jsonb_typeof(attachments) = 'array' THEN (
        SELECT ARRAY_AGG(x) FILTER (WHERE x IS NOT NULL)
        FROM (
          SELECT CASE
                   WHEN jsonb_typeof(value) = 'string' THEN trim(both '"' from value::text)
                   WHEN jsonb_typeof(value) = 'object' THEN value->> 'url'
                   ELSE NULL
                 END AS x
          FROM jsonb_array_elements(attachments) AS value
        ) AS e
      )
      ELSE NULL
    END AS urls
  FROM public.service_requests
), normalized AS (
  SELECT
    id,
    CASE
      WHEN urls IS NULL THEN NULL
      ELSE ARRAY(
        SELECT
          replace(
            replace(u, 'host.docker.internal', '127.0.0.1'),
            'http://localhost:', 'http://127.0.0.1:'
          )
        FROM unnest(urls) AS u
      )
    END AS urls
  FROM raw
)
UPDATE public.service_requests s
SET attachment_urls = n.urls
FROM normalized n
WHERE s.id = n.id
  AND n.urls IS NOT NULL;

-- Normalize existing applications.cv_url host for local dev consistency
UPDATE public.applications
SET cv_url = replace(replace(cv_url, 'host.docker.internal', '127.0.0.1'), 'http://localhost:', 'http://127.0.0.1:')
WHERE cv_url IS NOT NULL;

COMMENT ON COLUMN public.service_requests.attachment_urls IS 'Normalized list of attachment public URLs (text[])';

COMMIT;
