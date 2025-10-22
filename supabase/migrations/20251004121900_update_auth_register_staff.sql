set search_path to public, extensions;

create or replace function public.auth_register_staff(
  p_email text,
  p_full_name text,
  p_role public.user_role,
  p_department text default null,
  p_position text default null,
  p_phone text default null,
  p_password text default null,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_password text;
  v_username text;
begin
  if exists (select 1 from public.profiles where lower(email) = lower(p_email)) then
    raise exception 'Email already registered';
  end if;

  v_password := coalesce(p_password, substr(md5(random()::text), 1, 12));
  v_username := coalesce(nullif(p_username, ''), substr(regexp_replace(lower(p_full_name), '[^a-z0-9]+', '', 'g'), 1, 12) || to_char(floor(random() * 10000)::int, 'fm0000'));

  insert into public.profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    department,
    password_hash
  )
  values (
    gen_random_uuid(),
    p_full_name,
    lower(p_email),
    p_phone,
    p_role,
    p_department,
    public.hash_password(v_password)
  )
  returning * into v_profile;

  insert into public.staff_registrations (
    user_id,
    full_name,
    email,
    phone,
    department,
    position,
    role,
    username,
    employment_date,
    is_activated
  )
  values (
    v_profile.user_id,
    p_full_name,
    lower(p_email),
    p_phone,
    p_department,
    p_position,
    p_role,
    v_username,
    current_date,
    false
  );

  return jsonb_build_object(
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
end;
$$;
