-- ============================================================================
-- EcoClean Connect — REAL-TIME + ROW-LEVEL SECURITY (run AFTER schema.sql)
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase -> SQL Editor -> New query -> paste ALL of this -> Run.
-- Idempotent (safe to run more than once).
--
-- This does two things that together make the public "anon" key safe to put in
-- the browser for live updates:
--   1) Adds the tables to Supabase's realtime publication, so postgres_changes
--      events actually fire when rows change.
--   2) Enables Row-Level Security with READ-ONLY policies for the anon role.
--      => anon (the browser) can SELECT / subscribe, but CANNOT insert/update/
--         delete. All writes stay server-side via the service-role key, which
--         bypasses RLS. This is the trust boundary that lets us expose realtime.
-- ============================================================================

-- 1) Realtime publication ------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reports;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
  END IF;
END $$;

-- 2) Enable RLS ----------------------------------------------------------------
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts  ENABLE ROW LEVEL SECURITY;

-- 3) Read-only policies for the public (anon) + logged-in roles ----------------
--    USING (true) => every row is readable / subscribable. No INSERT/UPDATE/
--    DELETE policy for anon exists, so the public key can never write.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ecoclean public read reports') THEN
    CREATE POLICY "ecoclean public read reports" ON reports FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ecoclean public read alerts') THEN
    CREATE POLICY "ecoclean public read alerts" ON alerts FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- Done. Now set SUPABASE_ANON_KEY in Vercel (the anon/public key), redeploy, and
-- open two tabs: a new report in one appears instantly in the other.
-- ============================================================================
