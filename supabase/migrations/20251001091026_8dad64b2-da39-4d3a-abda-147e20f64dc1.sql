-- Create client_documents table for secure document sharing
CREATE TABLE public.client_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_confidential boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create client_feedback table
CREATE TABLE public.client_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'responded', 'closed')),
  response text,
  responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create service_requests table
CREATE TABLE public.service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_cost text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_documents
CREATE POLICY "Clients can view their own documents"
ON public.client_documents
FOR SELECT
USING (client_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Staff can manage all client documents"
ON public.client_documents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (current_setting('app.current_user_id', true))::uuid
    AND p.role IN (
      'super_admin',
      'hr_staff',
      'architectural_civil_head',
      'electrical_head',
      'mechanical_head',
      'ict_head',
      'material_testing_head',
      'consultancy_head'
    )
  )
);

-- RLS Policies for client_feedback
CREATE POLICY "Clients can view and create their own feedback"
ON public.client_feedback
FOR ALL
USING (client_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Staff can view and respond to all feedback"
ON public.client_feedback
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (current_setting('app.current_user_id', true))::uuid
    AND p.role IN (
      'super_admin',
      'hr_staff',
      'marketing_communications',
      'architectural_civil_head',
      'electrical_head',
      'mechanical_head',
      'ict_head',
      'material_testing_head',
      'consultancy_head'
    )
  )
);

-- RLS Policies for service_requests
CREATE POLICY "Clients can view and create their own service requests"
ON public.service_requests
FOR ALL
USING (client_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Staff can manage all service requests"
ON public.service_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (current_setting('app.current_user_id', true))::uuid
    AND p.role IN (
      'super_admin',
      'hr_staff',
      'architectural_civil_head',
      'electrical_head',
      'mechanical_head',
      'ict_head',
      'material_testing_head',
      'consultancy_head'
    )
  )
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_client_documents_updated_at
BEFORE UPDATE ON public.client_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_feedback_updated_at
BEFORE UPDATE ON public.client_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at
BEFORE UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();