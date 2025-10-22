-- Allow deletion of applications from the HR dashboard without relying on auth role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applications'
      AND policyname = 'Public can delete applications'
  ) THEN
    CREATE POLICY "Public can delete applications"
      ON public.applications
      FOR DELETE
      USING (true);
  END IF;
END
$$;
