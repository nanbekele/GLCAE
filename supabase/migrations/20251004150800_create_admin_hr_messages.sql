set search_path to public, extensions;

create table if not exists public.admin_hr_messages (
  id uuid primary key default gen_random_uuid(),
  sender_role text not null check (sender_role in ('admin', 'hr')),
  sender_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_hr_messages_created_at_idx on public.admin_hr_messages (created_at asc);
