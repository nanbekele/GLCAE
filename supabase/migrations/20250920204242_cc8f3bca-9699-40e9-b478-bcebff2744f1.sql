-- Create user roles enum
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'hr_staff',
  'architectural_civil_head',
  'electrical_head',
  'mechanical_head',
  'ict_head',
  'material_testing_head',
  'consultancy_head',
  'marketing_communications',
  'employee',
  'client'
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  services TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  department_id UUID REFERENCES public.departments(id),
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  department_id UUID REFERENCES public.departments(id),
  status TEXT NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  images TEXT[],
  documents TEXT[],
  client_id UUID REFERENCES public.profiles(id),
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inquiries table
CREATE TABLE public.inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  source_page TEXT,
  assigned_to_user_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  location TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  responsibilities TEXT NOT NULL,
  salary_range TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closes_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create applications table
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cv_url TEXT,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT[],
  timeline JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create news/posts table
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id),
  tags TEXT[],
  locale TEXT NOT NULL DEFAULT 'en',
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments (readable by everyone, manageable by admins)
CREATE POLICY "Departments are viewable by everyone" 
ON public.departments FOR SELECT 
USING (true);

CREATE POLICY "Only super admins can manage departments" 
ON public.departments FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view and update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all profiles" 
ON public.profiles FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for projects
CREATE POLICY "Public projects are viewable by everyone" 
ON public.projects FOR SELECT 
USING (visibility = 'public');

CREATE POLICY "Users can view projects they're assigned to" 
ON public.projects FOR SELECT 
USING (
  auth.role() = 'authenticated' AND (
    visibility = 'public' OR
    client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    department_id IN (
      SELECT department_id FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN (
        'super_admin',
        'architectural_civil_head',
        'electrical_head',
        'mechanical_head',
        'ict_head',
        'material_testing_head',
        'consultancy_head'
      )
    )
  )
);

CREATE POLICY "Department heads and super admins can manage projects" 
ON public.projects FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND (
      role = 'super_admin' OR (
        role IN (
          'architectural_civil_head',
          'electrical_head',
          'mechanical_head',
          'ict_head',
          'material_testing_head',
          'consultancy_head'
        )
        AND department_id = projects.department_id
      )
    )
  )
);

-- RLS Policies for inquiries
CREATE POLICY "Department heads can view their department inquiries" 
ON public.inquiries FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND (
      role = 'super_admin' OR (
        role IN (
          'architectural_civil_head',
          'electrical_head',
          'mechanical_head',
          'ict_head',
          'material_testing_head',
          'consultancy_head'
        )
        AND department_id = inquiries.department_id
      )
    )
  )
);

CREATE POLICY "Anyone can create inquiries" 
ON public.inquiries FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Department heads and super admins can manage inquiries" 
ON public.inquiries FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND (
      role = 'super_admin' OR (
        role IN (
          'architectural_civil_head',
          'electrical_head',
          'mechanical_head',
          'ict_head',
          'material_testing_head',
          'consultancy_head'
        )
        AND department_id = inquiries.department_id
      )
    )
  )
);

-- RLS Policies for jobs
CREATE POLICY "Jobs are viewable by everyone" 
ON public.jobs FOR SELECT 
USING (status = 'active');

CREATE POLICY "HR staff and super admins can manage jobs" 
ON public.jobs FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('hr_staff', 'super_admin')
  )
);

-- RLS Policies for applications
CREATE POLICY "HR staff and super admins can view applications" 
ON public.applications FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('hr_staff', 'super_admin')
  )
);

CREATE POLICY "Anyone can create applications" 
ON public.applications FOR INSERT 
WITH CHECK (true);

CREATE POLICY "HR staff and super admins can manage applications" 
ON public.applications FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('hr_staff', 'super_admin')
  )
);

-- RLS Policies for posts
CREATE POLICY "Published posts are viewable by everyone" 
ON public.posts FOR SELECT 
USING (status = 'published');

CREATE POLICY "Marketing and super admins can manage posts" 
ON public.posts FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('marketing_communications', 'super_admin')
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inquiries_updated_at
BEFORE UPDATE ON public.inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial departments
INSERT INTO public.departments (name, slug, description, services) VALUES
('Architectural & Civil Engineering', 'architectural-civil', 'Comprehensive architectural and civil engineering design services', ARRAY['Architectural Design', 'Structural Design', 'Construction Supervision', 'Contract Administration']),
('Mechanical Engineering', 'mechanical', 'Mechanical engineering design and installation services', ARRAY['HVAC Design', 'Plumbing Design', 'Fire Protection Systems', 'Mechanical Installation']),
('Electrical Engineering', 'electrical', 'Electrical engineering design and installation services', ARRAY['Electrical Design', 'Power Systems', 'Lighting Design', 'Security Systems']),
('Information & Communication Technology', 'ict', 'Complete ICT solutions and consulting services', ARRAY['ERP Solutions', 'Software Development', 'Network Design', 'CCTV & Access Control']),
('Material Testing & Inspection', 'material-testing', 'Professional material testing and quality inspection services', ARRAY['Concrete Testing', 'Steel Testing', 'Soil Analysis', 'Quality Control']),
('Consultancy Services', 'consultancy', 'Professional consulting and project management services', ARRAY['Project Management', 'Technical Consulting', 'Feasibility Studies', 'Risk Assessment']);

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();