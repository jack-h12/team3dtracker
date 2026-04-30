-- ============================================
-- ALLOW MULTIPLE LIFT SUBMISSIONS (with per-day cooldown)
--
-- Previously: UNIQUE (leaderboard_id, user_id) — one submission per user per leaderboard.
-- Now: a user may submit multiple entries to the same leaderboard, but at most
-- one new submission per 24 hours.
-- ============================================

-- 1. Drop the unique constraint that limited users to one submission per leaderboard.
ALTER TABLE lift_submissions
  DROP CONSTRAINT IF EXISTS lift_submissions_leaderboard_id_user_id_key;

-- 2. Enforce one submission per user per leaderboard per 24h (rolling window).
CREATE OR REPLACE FUNCTION enforce_lift_submission_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lift_submissions
    WHERE leaderboard_id = NEW.leaderboard_id
      AND user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'You can only submit one entry per leaderboard every 24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lift_submission_cooldown ON lift_submissions;
CREATE TRIGGER lift_submission_cooldown
  BEFORE INSERT ON lift_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_lift_submission_cooldown();
