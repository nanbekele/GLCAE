-- Create bucket used for service request attachments
insert into storage.buckets (id, name, public)
values ('service-request-files', 'service-request-files', true)
on conflict (id) do nothing;
