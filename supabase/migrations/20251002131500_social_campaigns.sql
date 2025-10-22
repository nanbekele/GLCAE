-- Social media campaign management table

create table if not exists public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook', 'linkedin', 'telegram', 'twitter')),
  title text not null,
  copy text not null,
  image_url text,
  scheduled_at timestamptz,
  approved boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_campaigns_platform_idx on public.social_campaigns (platform);
create index if not exists social_campaigns_approved_idx on public.social_campaigns (approved);
create index if not exists social_campaigns_scheduled_idx on public.social_campaigns (scheduled_at);

alter table public.social_campaigns enable row level security;

drop policy if exists "Allow marketing roles to view social campaigns" on public.social_campaigns;
create policy "Allow marketing roles to view social campaigns"
  on public.social_campaigns
  for select
  using (
    coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') in
      ('marketing_communications', 'super_admin')
    or auth.jwt() is null
  );

drop policy if exists "Allow marketing roles to manage social campaigns" on public.social_campaigns;
create policy "Allow marketing roles to manage social campaigns"
  on public.social_campaigns
  for all
  using (
    coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') in
      ('marketing_communications', 'super_admin')
    or auth.jwt() is null
  )
  with check (
    coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') in
      ('marketing_communications', 'super_admin')
    or auth.jwt() is null
  );
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;
create trigger set_timestamp_social_campaigns
  before update on public.social_campaigns
  for each row
  execute procedure public.set_current_timestamp_updated_at();
