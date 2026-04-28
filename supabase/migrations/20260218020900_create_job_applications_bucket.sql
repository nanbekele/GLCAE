-- Create bucket used for job application CV uploads
insert into storage.buckets (id, name, public)
values ('job-applications', 'job-applications', true)
on conflict (id) do nothing;

-- Allow public read/write for this bucket (the app uses anon key uploads)
drop policy if exists "Job application files are viewable by everyone" on storage.objects;
create policy "Job application files are viewable by everyone"
on storage.objects for select
using (bucket_id = 'job-applications');

drop policy if exists "Job application files are uploadable by everyone" on storage.objects;
create policy "Job application files are uploadable by everyone"
on storage.objects for insert
with check (bucket_id = 'job-applications');
