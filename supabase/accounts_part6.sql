-- ============================================================================
-- accounts_part6.sql — PARTNER APPLICATIONS  (run in Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Lets an association / municipality / club APPLY to bring EcoClean to their city
-- straight from the public site (the "Become a partner" form on /associations.html
-- and /impact.html). This turns the CTA from a mailto into a real, stored lead —
-- which is what an operating platform (not a demo) needs.
-- RLS: the public form inserts with the ANON key (no login required), so we allow
-- anon INSERT but NO anon SELECT — applications are private, read only by the
-- service role (a future admin "leads" view). Idempotent.
-- ============================================================================
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  city text not null,
  contact_name text,
  email text not null,
  org_type text,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists partner_app_created_idx on public.partner_applications(created_at desc);

alter table public.partner_applications enable row level security;
drop policy if exists "partner_app insert anon" on public.partner_applications;
create policy "partner_app insert anon" on public.partner_applications
  for insert to anon, authenticated with check (true);
-- No SELECT/UPDATE/DELETE policy for anon/authenticated => only service_role reads.
