create extension if not exists "pgcrypto";

create table if not exists public.interview_schedule_logs (
  id uuid primary key default gen_random_uuid(),
  applicant_name text not null,
  applicant_email text not null,
  interviewer text not null,
  interviewer_email text not null,
  position text not null,
  scheduled_for timestamptz not null,
  location text not null,
  notes text,
  organized_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert on public.interview_schedule_logs to authenticated;
