-- Update RLS policies for contact_messages to allow marketing and admin to view
DROP POLICY IF EXISTS "Marketing and admin can view contact messages" ON public.contact_messages;
CREATE POLICY "Marketing and admin can view contact messages"
ON public.contact_messages
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Marketing and admin can update contact messages" ON public.contact_messages;
CREATE POLICY "Marketing and admin can update contact messages"
ON public.contact_messages
FOR UPDATE
USING (true);

-- Update RLS policies for gallery_images to allow marketing to manage
DROP POLICY IF EXISTS "Marketing can insert gallery images" ON public.gallery_images;
CREATE POLICY "Marketing can insert gallery images"
ON public.gallery_images
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Marketing can update gallery images" ON public.gallery_images;
CREATE POLICY "Marketing can update gallery images"
ON public.gallery_images
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Marketing can delete gallery images" ON public.gallery_images;
CREATE POLICY "Marketing can delete gallery images"
ON public.gallery_images
FOR DELETE
USING (true);

-- Update RLS policies for applications to allow HR to view and manage
DROP POLICY IF EXISTS "HR can view all applications" ON public.applications;
CREATE POLICY "HR can view all applications"
ON public.applications
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "HR can update applications" ON public.applications;
CREATE POLICY "HR can update applications"
ON public.applications
FOR UPDATE
USING (true);