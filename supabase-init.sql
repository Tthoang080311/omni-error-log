create table if not exists public.omni_error_logs (
  id text primary key,
  subject_id text not null,
  payload jsonb not null,
  updated_at timestamptz default now()
);

alter table public.omni_error_logs enable row level security;

drop policy if exists "Allow full access for personal error log" on public.omni_error_logs;
create policy "Allow full access for personal error log"
on public.omni_error_logs
for all
to anon, authenticated
using (true)
with check (true);
