alter table public.reports add column if not exists rally_time timestamptz;

create table if not exists public.rally_attendees (
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.rally_attendees enable row level security;
drop policy if exists "rally_attendees read public" on public.rally_attendees;
create policy "rally_attendees read public" on public.rally_attendees for select using (true);
drop policy if exists "rally_attendees insert authenticated" on public.rally_attendees;
create policy "rally_attendees insert authenticated" on public.rally_attendees for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "rally_attendees delete authenticated" on public.rally_attendees;
create policy "rally_attendees delete authenticated" on public.rally_attendees for delete to authenticated using (auth.uid() = user_id);

-- PostgREST needs to reload its schema cache for new tables/columns
notify pgrst, 'reload schema';
