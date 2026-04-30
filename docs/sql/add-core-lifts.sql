-- ============================================
-- CORE LIFTS
--
-- Permanent leaderboards for the five major lifts (Squat, Bench, Deadlift,
-- Military Press, Pull-Ups) with absolute and pound-for-pound (DOTS) views.
-- Each user has a lift profile (height, weight, optional body composition)
-- and submissions snapshot the user's bodyweight at submission time.
--
-- Canonical units in DB: cm + kg. UI converts to lbs/inches as needed.
-- Cooldown: at most one submission per user per core lift per 24 hours.
-- ============================================

-- 1. User lift profile (one row per user).
CREATE TABLE IF NOT EXISTS lift_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  height_cm NUMERIC NOT NULL CHECK (height_cm > 0 AND height_cm < 300),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  resting_hr INTEGER CHECK (resting_hr IS NULL OR (resting_hr > 0 AND resting_hr < 250)),
  body_fat_pct NUMERIC CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct < 70)),
  unit_pref TEXT NOT NULL DEFAULT 'imperial' CHECK (unit_pref IN ('imperial','metric')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lift_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view lift profiles" ON lift_profiles;
CREATE POLICY "Authenticated can view lift profiles" ON lift_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can upsert own lift profile" ON lift_profiles;
CREATE POLICY "Users can upsert own lift profile" ON lift_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lift profile" ON lift_profiles;
CREATE POLICY "Users can update own lift profile" ON lift_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lift profile" ON lift_profiles;
CREATE POLICY "Users can delete own lift profile" ON lift_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Core lifts catalog (seeded — these never go away).
CREATE TABLE IF NOT EXISTS core_lifts (
  id TEXT PRIMARY KEY,
  exercise TEXT NOT NULL,    -- 'squat'|'bench'|'deadlift'|'ohp'|'pullup'
  variant TEXT NOT NULL,     -- '1rm'|'5rm'|'10rm'|'amrap_bw'|'weighted_1rm'
  display_name TEXT NOT NULL,
  unit TEXT NOT NULL,        -- 'weight' (kg in DB) | 'reps'
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE core_lifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view core lifts" ON core_lifts;
CREATE POLICY "Authenticated can view core lifts" ON core_lifts
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO core_lifts (id, exercise, variant, display_name, unit, sort_order) VALUES
  ('squat_1rm',          'squat',    '1rm',          '1 Rep Max',         'weight', 1),
  ('squat_5rm',          'squat',    '5rm',          '5 Rep Max',         'weight', 2),
  ('squat_10rm',         'squat',    '10rm',         '10 Rep Max',        'weight', 3),
  ('bench_1rm',          'bench',    '1rm',          '1 Rep Max',         'weight', 1),
  ('bench_5rm',          'bench',    '5rm',          '5 Rep Max',         'weight', 2),
  ('bench_10rm',         'bench',    '10rm',         '10 Rep Max',        'weight', 3),
  ('deadlift_1rm',       'deadlift', '1rm',          '1 Rep Max',         'weight', 1),
  ('deadlift_5rm',       'deadlift', '5rm',          '5 Rep Max',         'weight', 2),
  ('deadlift_10rm',      'deadlift', '10rm',         '10 Rep Max',        'weight', 3),
  ('ohp_1rm',            'ohp',      '1rm',          '1 Rep Max',         'weight', 1),
  ('ohp_5rm',            'ohp',      '5rm',          '5 Rep Max',         'weight', 2),
  ('ohp_10rm',           'ohp',      '10rm',         '10 Rep Max',        'weight', 3),
  ('pullup_amrap',       'pullup',   'amrap_bw',     'Bodyweight AMRAP',  'reps',   1),
  ('pullup_weighted_1rm','pullup',   'weighted_1rm', 'Weighted 1 Rep Max','weight', 2)
ON CONFLICT (id) DO NOTHING;

-- 3. Submissions to core lifts.
CREATE TABLE IF NOT EXISTS core_lift_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  core_lift_id TEXT NOT NULL REFERENCES core_lifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL CHECK (value > 0),     -- kg for weight lifts (or added weight on weighted pullup); reps for AMRAP
  bodyweight_kg NUMERIC NOT NULL CHECK (bodyweight_kg > 0),
  video_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_lift_subs_lift_value ON core_lift_submissions(core_lift_id, value DESC);
CREATE INDEX IF NOT EXISTS idx_core_lift_subs_user ON core_lift_submissions(user_id);

ALTER TABLE core_lift_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view core lift submissions" ON core_lift_submissions;
CREATE POLICY "Authenticated can view core lift submissions" ON core_lift_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can submit own core lift entry" ON core_lift_submissions;
CREATE POLICY "Users can submit own core lift entry" ON core_lift_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User or admin can delete core lift submission" ON core_lift_submissions;
CREATE POLICY "User or admin can delete core lift submission" ON core_lift_submissions
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 4. Cooldown: at most one submission per user per core lift per 24h.
CREATE OR REPLACE FUNCTION enforce_core_lift_submission_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM core_lift_submissions
    WHERE core_lift_id = NEW.core_lift_id
      AND user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'You can only submit one entry per core lift every 24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS core_lift_submission_cooldown ON core_lift_submissions;
CREATE TRIGGER core_lift_submission_cooldown
  BEFORE INSERT ON core_lift_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_core_lift_submission_cooldown();

-- 5. Reuse existing 'lift-videos' storage bucket — no new bucket needed.
