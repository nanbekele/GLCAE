-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Create consultancyrequest table
create table if not exists public.consultancyrequest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  department text not null check (department in ('ICT','Mechanical','Material Testing','Architectural & Civil')),
  title text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  assigned_employee uuid null references public.profiles(id) on delete set null,
  schedule_at timestamptz null,
  notes text null
);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_consultancyrequest_updated_at on public.consultancyrequest;
create trigger trg_consultancyrequest_updated_at
before update on public.consultancyrequest
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.consultancyrequest enable row level security;

-- Policies
-- Insert: allow the authenticated user to insert for their own profile
drop policy if exists consultancyrequest_insert_self on public.consultancyrequest;
create policy consultancyrequest_insert_self on public.consultancyrequest
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = consultancyrequest.client_id
        and p.user_id = auth.uid()
    )
  );

-- Select: client can read their own rows; heads can read department rows
drop policy if exists consultancyrequest_select_client on public.consultancyrequest;
create policy consultancyrequest_select_client on public.consultancyrequest
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = consultancyrequest.client_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p2
      where p2.user_id = auth.uid()
        and p2.role in ('mechanical_head','ict_head','material_testing_head','architectural_civil_head')
    )
  );

-- Update: heads or assigned employee can update
drop policy if exists consultancyrequest_update_head_or_assignee on public.consultancyrequest;
create policy consultancyrequest_update_head_or_assignee on public.consultancyrequest
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.id = consultancyrequest.assigned_employee
          or p.role in ('mechanical_head','ict_head','material_testing_head','architectural_civil_head')
        )
    )
  )
  with check (
    true
  );

-- Optional: clients cannot delete; only service role/admin can manage deletes
