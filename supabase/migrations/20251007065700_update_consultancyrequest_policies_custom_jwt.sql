-- Update RLS policies on consultancyrequest to support custom JWT where sub may map to profiles.id or profiles.user_id

-- Ensure RLS is enabled
alter table if exists public.consultancyrequest enable row level security;

-- Insert policy: allow when JWT sub matches either profiles.id or profiles.user_id for the given client_id
drop policy if exists consultancyrequest_insert_self on public.consultancyrequest;
create policy consultancyrequest_insert_self on public.consultancyrequest
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = consultancyrequest.client_id
        and (
          (auth.jwt() ->> 'sub')::text = p.id::text
          or (auth.jwt() ->> 'sub')::text = p.user_id::text
        )
    )
  );

-- Select policy: allow clients to read their own rows with same mapping
drop policy if exists consultancyrequest_select_client on public.consultancyrequest;
create policy consultancyrequest_select_client on public.consultancyrequest
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = consultancyrequest.client_id
        and (
          (auth.jwt() ->> 'sub')::text = p.id::text
          or (auth.jwt() ->> 'sub')::text = p.user_id::text
        )
    )
  );

-- Keep previous update policies intact (heads/assignees). If missing, a permissive minimal update policy can be added separately.

-- Grants (idempotent)
grant usage on schema public to authenticated;
grant select, insert, update on public.consultancyrequest to authenticated;
