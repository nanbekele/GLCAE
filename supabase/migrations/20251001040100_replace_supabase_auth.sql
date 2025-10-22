
SET search_path TO public, extensions;

-- Ensure required extension for password hashing

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Drop dependencies on auth.users
ALTER TABLE IF EXISTS public.staff_registrations DROP CONSTRAINT IF EXISTS staff_registrations_user_id_fkey;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Ensure user_id is generated inside profiles
ALTER TABLE public.profiles ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN user_id SET DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_key;

ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

ALTER TABLE IF EXISTS public.staff_registrations
  DROP CONSTRAINT IF EXISTS staff_registrations_user_id_fkey;

ALTER TABLE public.staff_registrations
  ADD CONSTRAINT staff_registrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add password hash column if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Backfill missing password hashes with a default placeholder ("changeme")
UPDATE public.profiles
SET password_hash = extensions.crypt('changeme', extensions.gen_salt('bf'))
WHERE password_hash IS NULL;

ALTER TABLE public.profiles ALTER COLUMN password_hash SET NOT NULL;

-- Disable RLS temporarily to allow custom auth functions to manage access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_registrations DISABLE ROW LEVEL SECURITY;

-- Drop obsolete trigger/function from Supabase auth sync
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Helper functions for hashing and verification
CREATE OR REPLACE FUNCTION public.hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE SQL
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'));
$$;

CREATE OR REPLACE FUNCTION public.verify_password(p_password TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SET search_path = public, extensions
AS $$
  SELECT p_hash = extensions.crypt(p_password, p_hash);
$$;

-- Login function returning profile data without password hash
CREATE OR REPLACE FUNCTION public.auth_login(p_email TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  IF NOT public.verify_password(p_password, v_profile.password_hash) THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'role', v_profile.role,
    'department', v_profile.department,
    'is_active', v_profile.is_active,
    'created_at', v_profile.created_at,
    'updated_at', v_profile.updated_at
  );
END;
$$;

-- Change password function
CREATE OR REPLACE FUNCTION public.auth_change_password(
  p_user_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT public.verify_password(p_old_password, v_profile.password_hash) THEN
    RAISE EXCEPTION 'Invalid current password';
  END IF;

  UPDATE public.profiles
  SET password_hash = public.hash_password(p_new_password),
      updated_at = now()
  WHERE id = v_profile.id;

  RETURN TRUE;
END;
$$;

-- Staff registration function returning profile plus generated password
CREATE OR REPLACE FUNCTION public.auth_register_staff(
  p_email TEXT,
  p_full_name TEXT,
  p_role public.user_role,
  p_department TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_password TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(email) = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  v_password := COALESCE(
    p_password,
    substr(md5(random()::text), 1, 12)
  );

  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    department,
    password_hash
  )
  VALUES (
    gen_random_uuid(),
    p_full_name,
    lower(p_email),
    p_phone,
    p_role,
    p_department,
    public.hash_password(v_password)
  )
  RETURNING * INTO v_profile;

  INSERT INTO public.staff_registrations (
    user_id,
    full_name,
    email,
    phone,
    department,
    position,
    role,
    employment_date,
    is_activated
  )
  VALUES (
    v_profile.user_id,
    p_full_name,
    lower(p_email),
    p_phone,
    p_department,
    p_position,
    p_role,
    CURRENT_DATE,
    false
  );

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'phone', v_profile.phone,
      'role', v_profile.role,
      'department', v_profile.department,
      'is_active', v_profile.is_active,
      'created_at', v_profile.created_at,
      'updated_at', v_profile.updated_at
    ),
    'password', v_password
  );
END;
$$;

-- Re-enable basic RLS: authenticated users can select their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "staff_select_self" ON public.staff_registrations;

CREATE POLICY "profiles_select_self"
ON public.profiles FOR SELECT
USING (auth.jwt() ->> 'sub' = user_id::TEXT);

CREATE POLICY "staff_select_self"
ON public.staff_registrations FOR SELECT
USING (auth.jwt() ->> 'sub' = user_id::TEXT);

-- Client self-registration function
CREATE OR REPLACE FUNCTION public.auth_register_client(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(email) = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    password_hash
  )
  VALUES (
    gen_random_uuid(),
    p_full_name,
    lower(p_email),
    p_phone,
    'client',
    public.hash_password(p_password)
  )
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'role', v_profile.role,
    'department', v_profile.department,
    'is_active', v_profile.is_active,
    'created_at', v_profile.created_at,
    'updated_at', v_profile.updated_at
  );
END;
$$;
