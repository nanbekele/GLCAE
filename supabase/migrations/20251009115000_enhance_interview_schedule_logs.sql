-- Add applicant/interviewer profile references and supporting indexes, then backfill
alter table if exists public.interview_schedule_logs
  add column if not exists applicant_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists interviewer_profile_id uuid references public.profiles(id) on delete set null;

-- Indexes for efficient lookups
create index if not exists idx_isl_lower_applicant_email on public.interview_schedule_logs ((lower(applicant_email)));
create index if not exists idx_isl_lower_interviewer_email on public.interview_schedule_logs ((lower(interviewer_email)));
create index if not exists idx_isl_applicant_profile_id on public.interview_schedule_logs (applicant_profile_id);
create index if not exists idx_isl_interviewer_profile_id on public.interview_schedule_logs (interviewer_profile_id);
create index if not exists idx_isl_scheduled_for on public.interview_schedule_logs (scheduled_for);

-- Backfill profile references by matching email
update public.interview_schedule_logs isl
set applicant_profile_id = p.id
from public.profiles p
where isl.applicant_profile_id is null
  and lower(p.email) = lower(isl.applicant_email);

update public.interview_schedule_logs isl
set interviewer_profile_id = p.id
from public.profiles p
where isl.interviewer_profile_id is null
  and lower(p.email) = lower(isl.interviewer_email);
