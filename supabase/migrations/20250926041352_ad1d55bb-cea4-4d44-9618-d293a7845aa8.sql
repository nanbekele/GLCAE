-- Create staff registration table for internal users
CREATE TABLE public.staff_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  department TEXT,
  role TEXT NOT NULL,
  profile_picture_url TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  is_activated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only HR and super admins can manage staff registrations" 
ON public.staff_registrations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('hr_staff', 'super_admin')
));

-- Add gallery table for marketing management
CREATE TABLE public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for gallery
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Gallery policies
CREATE POLICY "Gallery images are viewable by everyone" 
ON public.gallery_images 
FOR SELECT 
USING (true);

CREATE POLICY "Marketing can manage gallery images" 
ON public.gallery_images 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('marketing_communications', 'super_admin')
));

-- Remove approval requirement from profiles by updating default is_active to true
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT true;

-- Create trigger for updated_at
CREATE TRIGGER update_staff_registrations_updated_at
BEFORE UPDATE ON public.staff_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gallery_images_updated_at
BEFORE UPDATE ON public.gallery_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();