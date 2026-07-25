-- ============================================================================
-- EcoClean Connect — REAL-TIME + ROW-LEVEL SECURITY (run AFTER schema.sql)
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase -> SQL Editor -> New query -> paste ALL of this -> Run.
-- Idempotent (safe to run more than once).
--
-- ORDER MATTERS: run THIS before you expose the anon key in Vercel. Until RLS is
-- enabled with read-only policies + grants, the anon key must not be public.
--
-- What it does:
--   1) Adds the tables to the realtime publication (so postgres_changes fires).
--   2) Enables Row-Level Security.
--   3) Grants SELECT (read / subscribe) to anon + authenticated — NO write grants.
--   4) Adds SELECT-only RLS policies (USING (true)) for anon + authenticated.
--      => the public anon key can read / subscribe but NEVER write. All writes
--         stay server-side via the service-role key (which bypasses RLS).
-- ============================================================================

-- 0) Schema access for the public roles (idempotent) ---------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Realtime publication ------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reports') THEN ALTER PUBLICATION supabase_realtime ADD TABLE reports; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='alerts')  THEN ALTER PUBLICATION supabase_realtime ADD TABLE alerts;  END IF;
END $$;

-- 2) Enable Row-Level Security -------------------------------------------------
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts  ENABLE ROW LEVEL SECURITY;

-- 3) Read-only table privileges (NO insert/update/delete for public roles) -----
GRANT SELECT ON reports TO anon, authenticated;
GRANT SELECT ON alerts  TO anon, authenticated;

-- 4) Read-only RLS policies ----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='ecoclean public read reports') THEN CREATE POLICY "ecoclean public read reports" ON reports FOR SELECT TO anon, authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='ecoclean public read alerts')  THEN CREATE POLICY "ecoclean public read alerts"  ON alerts  FOR SELECT TO anon, authenticated USING (true); END IF;
END $$;

-- Done. NOW set SUPABASE_ANON_KEY in Vercel (the anon/public key) and Redeploy.
-- Then open two tabs and create a report in one — it appears in the other in ~1s.
-- ============================================================================
