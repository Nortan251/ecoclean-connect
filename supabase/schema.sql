-- EcoClean Connect — Supabase schema
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

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

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
CREATE INDEX IF NOT EXISTS reports_category_idx ON reports (category);
