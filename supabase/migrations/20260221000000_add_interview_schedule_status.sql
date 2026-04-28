alter table if exists public.interview_schedule_logs
  add column if not exists status text not null default 'waiting';

create index if not exists idx_isl_status on public.interview_schedule_logs (status);
