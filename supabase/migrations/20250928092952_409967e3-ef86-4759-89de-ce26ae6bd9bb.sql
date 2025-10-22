-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.staff_registrations CASCADE;

-- Update user_role enum with all required roles
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'architectural_civil_head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'electrical_head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'mechanical_head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ict_head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'material_testing_head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'consultancy_head';

-- Create profiles table (Master user profile)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'client',
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff_registrations table (Staff-specific details)
CREATE TABLE public.staff_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT NOT NULL,
  position TEXT,
  role user_role NOT NULL,
  username TEXT NOT NULL UNIQUE,
  employment_date DATE DEFAULT CURRENT_DATE,
  is_activated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  registered_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Drop existing policies to redefine them
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins and HR can manage all profiles" ON public.profiles;

-- New RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_super_admin_or_hr(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = p_user_id
    AND role IN ('super_admin', 'hr_staff')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE POLICY "Super admins and HR can view all profiles"
ON public.profiles FOR SELECT
USING (
  public.is_super_admin_or_hr(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Super admins and HR can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('super_admin', 'hr_staff')
  )
);

CREATE POLICY "Super admins and HR can update all profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('super_admin', 'hr_staff')
  )
);

CREATE POLICY "Super admins and HR can delete all profiles"
ON public.profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('super_admin', 'hr_staff')
  )
);

-- RLS Policies for staff_registrations
CREATE POLICY "HR and super admins can manage staff registrations" 
ON public.staff_registrations FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('super_admin', 'hr_staff')
  )
);

CREATE POLICY "Staff can view their own registration" 
ON public.staff_registrations FOR SELECT 
USING (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile entry for new user
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_registrations_updated_at
  BEFORE UPDATE ON public.staff_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();