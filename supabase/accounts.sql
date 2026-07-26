-- ============================================================================
-- EcoClean Connect — ACCOUNTS (Module F). Run AFTER schema.sql + realtime-rls.sql.
-- Adds OPTIONAL user accounts (Supabase Auth, email+password) ON TOP of anonymous
-- reporting (which stays open — login is never required to report).
--   * profiles  = display_name + SERVER-SIDE points (the source of truth for rewards).
--   * vouchers  = server-minted reward codes, readable only by their owner (RLS).
--   * reports   gain reporter_user_id (who reported, if signed in) + rewarded flag.
--   * Points are awarded SERVER-SIDE when a report is verified (award_points), so
--     rewards can't be faked from the client. A DB trigger auto-creates a profile
--     on sign-up so awards always have a target.
--   * RLS: profiles readable by all (leaderboard) but only the owner edits their
--     name (column-level grant stops anyone touching `points`); vouchers owner-only.
-- Idempotent.
-- ============================================================================

-- 1) tables -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Guardian',
  points int not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  points int not null,
  created_at timestamptz not null default now()
);
create unique index if not exists vouchers_user_code_idx on public.vouchers(user_id, code);

alter table public.reports add column if not exists reporter_user_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists rewarded boolean not null default false;
create index if not exists reports_reporter_idx on public.reports(reporter_user_id);

-- 2) server-side reward logic (security definer => bypass RLS) -----------------
create or replace function public.award_points(uid uuid, amt int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points = points + amt where id = uid;
end $$;

create or replace function public.mint_voucher(uid uuid, cost int, out code text)
language plpgsql security definer set search_path = public as $$
declare pts int;
begin
  select points into pts from public.profiles where id = uid for update;
  if pts is null or pts < cost then code := null; return; end if;
  code := 'ECO-' || upper(substr(md5(random()::text || uid::text), 1, 8));
  update public.profiles set points = points - cost where id = uid;
  insert into public.vouchers(user_id, code, points) values (uid, code, cost);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Guardian'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Row-Level Security -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vouchers enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "vouchers read own" on public.vouchers;
create policy "vouchers read own" on public.vouchers for select to authenticated using (user_id = auth.uid());

-- 4) column-level grants (RLS update can never touch `points`) ----------------
grant select on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.vouchers to authenticated;
-- ============================================================================
