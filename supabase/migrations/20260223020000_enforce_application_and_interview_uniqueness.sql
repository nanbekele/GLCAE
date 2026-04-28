-- Enforce single application per job per applicant (email), and single interview schedule per job per applicant

-- 1) Add job_id to interview schedule logs so we can enforce uniqueness per job
alter table if exists public.interview_schedule_logs
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

create index if not exists idx_isl_job_id on public.interview_schedule_logs (job_id);

-- 2) Block duplicate applications per job (case-insensitive email)
create or replace function public.enforce_single_application_per_job()
returns trigger as $$
begin
  if exists (
    select 1
    from public.applications a
    where a.job_id = new.job_id
      and lower(a.email) = lower(new.email)
  ) then
    raise exception 'duplicate_application_per_job'
      using errcode = '23505';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_enforce_single_application_per_job on public.applications;
create trigger trg_enforce_single_application_per_job
before insert on public.applications
for each row execute function public.enforce_single_application_per_job();

-- 3) Block duplicate interview schedules per job (case-insensitive applicant email)
create or replace function public.enforce_single_interview_schedule_per_job()
returns trigger as $$
begin
  if new.job_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.interview_schedule_logs l
    where l.job_id = new.job_id
      and lower(l.applicant_email) = lower(new.applicant_email)
  ) then
    raise exception 'duplicate_interview_schedule_per_job'
      using errcode = '23505';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_enforce_single_interview_schedule_per_job on public.interview_schedule_logs;
create trigger trg_enforce_single_interview_schedule_per_job
before insert on public.interview_schedule_logs
for each row execute function public.enforce_single_interview_schedule_per_job();
