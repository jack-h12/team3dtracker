-- ============================================
-- LIFT LEADERBOARDS
-- User-created weekly competitions (e.g. 5RM bench press) where
-- participants log a personal best with a video proof.
-- The top submitter at end-of-week wins 250 XP and 500 gold.
-- Each user may only create one leaderboard per 7-day window.
-- ============================================

-- 1. Tables
CREATE TABLE IF NOT EXISTS lift_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'lbs',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed'
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reward_distributed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lift_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES lift_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  reps INTEGER,
  video_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (leaderboard_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lift_lb_status_ends ON lift_leaderboards(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_lift_lb_created ON lift_leaderboards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lift_subs_lb_value ON lift_submissions(leaderboard_id, value DESC);
CREATE INDEX IF NOT EXISTS idx_lift_subs_user ON lift_submissions(user_id);

-- 2. RLS
ALTER TABLE lift_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lift_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view lift leaderboards" ON lift_leaderboards;
CREATE POLICY "Authenticated can view lift leaderboards" ON lift_leaderboards
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create lift leaderboards" ON lift_leaderboards;
CREATE POLICY "Users can create lift leaderboards" ON lift_leaderboards
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creator or admin can update lift leaderboards" ON lift_leaderboards;
CREATE POLICY "Creator or admin can update lift leaderboards" ON lift_leaderboards
  FOR UPDATE USING (
    auth.uid() = creator_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "Creator or admin can delete lift leaderboards" ON lift_leaderboards;
CREATE POLICY "Creator or admin can delete lift leaderboards" ON lift_leaderboards
  FOR DELETE USING (
    auth.uid() = creator_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "Authenticated can view lift submissions" ON lift_submissions;
CREATE POLICY "Authenticated can view lift submissions" ON lift_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can submit own lift entry" ON lift_submissions;
CREATE POLICY "Users can submit own lift entry" ON lift_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lift entry" ON lift_submissions;
CREATE POLICY "Users can update own lift entry" ON lift_submissions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User or admin can delete lift submission" ON lift_submissions;
CREATE POLICY "User or admin can delete lift submission" ON lift_submissions
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 3. Enforce: one leaderboard per user per 7 days, and ends_at must be in future
CREATE OR REPLACE FUNCTION enforce_lift_leaderboard_create_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lift_leaderboards
    WHERE creator_id = NEW.creator_id
      AND created_at > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'You can only create one lift leaderboard every 7 days';
  END IF;

  -- Default ends_at to 7 days after starts_at if not given
  IF NEW.ends_at IS NULL THEN
    NEW.ends_at := NEW.starts_at + INTERVAL '7 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lift_leaderboard_create_rules ON lift_leaderboards;
CREATE TRIGGER lift_leaderboard_create_rules
  BEFORE INSERT ON lift_leaderboards
  FOR EACH ROW EXECUTE FUNCTION enforce_lift_leaderboard_create_rules();

-- 4. Finalize ended leaderboards: pick winner, award XP and gold
CREATE OR REPLACE FUNCTION finalize_ended_lift_leaderboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lb RECORD;
  top_user UUID;
BEGIN
  FOR lb IN
    SELECT id FROM lift_leaderboards
    WHERE status = 'active'
      AND ends_at <= NOW()
      AND reward_distributed = FALSE
  LOOP
    SELECT user_id INTO top_user
    FROM lift_submissions
    WHERE leaderboard_id = lb.id
    ORDER BY value DESC, created_at ASC
    LIMIT 1;

    IF top_user IS NOT NULL THEN
      UPDATE profiles
      SET lifetime_exp = lifetime_exp + 250,
          gold = gold + 500
      WHERE id = top_user;

      UPDATE lift_leaderboards
      SET status = 'completed',
          winner_id = top_user,
          reward_distributed = TRUE
      WHERE id = lb.id;
    ELSE
      UPDATE lift_leaderboards
      SET status = 'completed',
          reward_distributed = TRUE
      WHERE id = lb.id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_ended_lift_leaderboards() TO postgres;
GRANT EXECUTE ON FUNCTION finalize_ended_lift_leaderboards() TO authenticated;

-- 5. Schedule finalize to run hourly via pg_cron (no-op if already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-lift-leaderboards') THEN
      PERFORM cron.unschedule('finalize-lift-leaderboards');
    END IF;
    PERFORM cron.schedule(
      'finalize-lift-leaderboards',
      '5 * * * *',
      $cron$SELECT finalize_ended_lift_leaderboards();$cron$
    );
  END IF;
END $$;

-- 6. Storage bucket for proof videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lift-videos', 'lift-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view lift videos" ON storage.objects;
CREATE POLICY "Anyone can view lift videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'lift-videos');

DROP POLICY IF EXISTS "Users can upload own lift videos" ON storage.objects;
CREATE POLICY "Users can upload own lift videos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lift-videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users or admins can delete lift videos" ON storage.objects;
CREATE POLICY "Users or admins can delete lift videos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'lift-videos' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    )
  );
