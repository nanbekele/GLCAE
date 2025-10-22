-- Update consultancyrequest policies to support client inserts and shared access

-- Ensure authenticated role has necessary privileges
grant usage on schema public to authenticated;
grant select, insert, update on public.consultancyrequest to authenticated;

drop policy if exists consultancyrequest_insert_self on public.consultancyrequest;
create policy consultancyrequest_insert_self on public.consultancyrequest
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (
      consultancyrequest.client_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = consultancyrequest.client_id
          and (p.user_id = auth.uid() or p.id = auth.uid())
      )
    )
  );

drop policy if exists consultancyrequest_select_client on public.consultancyrequest;
create policy consultancyrequest_select_client on public.consultancyrequest
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = consultancyrequest.client_id
        and (p.user_id = auth.uid() or p.id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p2
      where p2.user_id = auth.uid()
        and p2.role in ('mechanical_head','ict_head','material_testing_head','architectural_civil_head')
    )
  );

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
