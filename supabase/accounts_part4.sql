-- ============================================================================
-- accounts_part4.sql — WEB PUSH subscriptions  (run in Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Stores a browser PushSubscription per signed-in user so the server can send
-- "a report near you was verified" notifications (push.js + /api/push/*). Keys are
-- stored verbatim (p256dh + auth) because web-push needs both to encrypt the
-- payload. RLS: a user can only read / write / delete THEIR OWN subscriptions
-- (the service role used by our endpoints bypasses RLS, as intended). Idempotent.
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  city text,                                  -- optional: the zone the user subscribed to
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)                  -- one row per device/subscription
);
create index if not exists push_sub_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push read own" on public.push_subscriptions;
create policy "push read own" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "push insert own" on public.push_subscriptions;
create policy "push insert own" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "push delete own" on public.push_subscriptions;
create policy "push delete own" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);
