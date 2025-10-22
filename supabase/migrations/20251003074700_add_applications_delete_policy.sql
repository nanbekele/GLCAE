-- Allow HR staff and super admins to delete applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applications'
      AND policyname = 'HR staff and super admins can delete applications'
  ) THEN
    CREATE POLICY "HR staff and super admins can delete applications"
      ON public.applications
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE user_id = auth.uid()
            AND role IN ('hr_staff', 'super_admin')
        )
      );
  END IF;
END
$$;
