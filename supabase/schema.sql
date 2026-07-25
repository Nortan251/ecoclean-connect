-- ============================================================================
-- EcoClean Connect — ONE-TIME database setup
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste ALL of
-- this -> Run. It is idempotent (safe to run more than once).
-- This single script creates everything the backend needs: the `reports` and
-- `alerts` tables, their indexes, AND the public storage bucket `ecoclean`
-- (where report photos live). No separate "create bucket" step required.
-- ============================================================================

-- 1) Reports table (the core of the app) --------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name text NOT NULL DEFAULT 'Anonymous',
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  before_photo text,
  after_photo text,
  status text NOT NULL DEFAULT 'reported',
  verification_notes text NOT NULL DEFAULT '',
  reward_code text,
  reward_issued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

-- 2) Community alerts table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes (speed up the dashboard + map queries) ---------------------------
CREATE INDEX IF NOT EXISTS reports_status_idx   ON reports (status);
CREATE INDEX IF NOT EXISTS reports_category_idx ON reports (category);

-- 4) Public storage bucket for report photos ----------------------------------
--    The API uploads photos with the service-role key (bypasses storage RLS),
--    and the bucket is PUBLIC so the returned photo URLs render in the map
--    without authentication. If the bucket already exists, this just makes
--    sure it is public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecoclean', 'ecoclean', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Done. After running this, open https://<your-site>/api/health in a browser;
-- every field should read "ok": true.
-- ============================================================================
