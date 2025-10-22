-- Marketing content enhancements
-- Adds news metadata and expands project portfolio fields

alter table public.posts
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists cover_image_url text;

alter table public.posts
  alter column status set default 'draft';

create index if not exists posts_category_idx on public.posts (category);

alter table public.projects
  add column if not exists summary text,
  add column if not exists media_type text default 'image',
  add column if not exists media_url text,
  add column if not exists featured boolean default false;

update public.projects
  set media_type = coalesce(media_type, 'image');

alter table public.projects
  alter column visibility set default 'public';

insert into storage.buckets (id, name, public)
  values ('news-media', 'news-media', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('project-media', 'project-media', true)
  on conflict (id) do nothing;
