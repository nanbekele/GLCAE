-- Idempotent migration to ensure consultancyrequest exists and has contact_email
-- 1) Ensure pgcrypto for UUIDs
create extension if not exists pgcrypto;

-- 2) Create table if it does not exist (includes contact_email)
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
  notes text null,
  contact_email text
);

-- 3) Add the column if table already existed without it
alter table if exists public.consultancyrequest
  add column if not exists contact_email text;

-- 4) Updated-at trigger function and trigger
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

-- 5) Enable RLS and minimal policies using auth.jwt() claims (custom auth)
alter table public.consultancyrequest enable row level security;

-- Allow authenticated insert of own records (JWT sub matches client_id)
drop policy if exists consultancyrequest_insert_self on public.consultancyrequest;
create policy consultancyrequest_insert_self on public.consultancyrequest
  for insert to authenticated
  with check ((auth.jwt() ->> 'sub')::uuid = client_id);

-- Allow authenticated select of own records
drop policy if exists consultancyrequest_select_client on public.consultancyrequest;
create policy consultancyrequest_select_client on public.consultancyrequest
  for select to authenticated
  using ((auth.jwt() ->> 'sub')::uuid = client_id);

-- 6) Grant privileges to authenticated role (idempotent)
grant usage on schema public to authenticated;
grant select, insert, update on public.consultancyrequest to authenticated;
