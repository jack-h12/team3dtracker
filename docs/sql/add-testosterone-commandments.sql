-- Ten Testosterone Commandments daily scores
--
-- One row per user / day / commandment. The "score_date" is the task day
-- in Eastern time (same 5pm EST reset boundary used elsewhere), so a
-- YYYY-MM-DD string derived via getCurrentTaskDate() in lib/tasks.ts.
--
-- Commandments (see lib/testosterone.ts for the canonical list):
--   steak, sweets, sleep, stress, sunlight, stomach,
--   status, connection, steps, strength

CREATE TABLE IF NOT EXISTS testosterone_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  commandment TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, score_date, commandment)
);

CREATE INDEX IF NOT EXISTS idx_testosterone_scores_user_date
  ON testosterone_scores (user_id, score_date);

CREATE INDEX IF NOT EXISTS idx_testosterone_scores_date
  ON testosterone_scores (score_date);

ALTER TABLE testosterone_scores ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read all rows (needed for the leaderboard).
DROP POLICY IF EXISTS "testosterone_scores_select_all" ON testosterone_scores;
CREATE POLICY "testosterone_scores_select_all"
  ON testosterone_scores
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only write their own rows.
DROP POLICY IF EXISTS "testosterone_scores_insert_own" ON testosterone_scores;
CREATE POLICY "testosterone_scores_insert_own"
  ON testosterone_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "testosterone_scores_update_own" ON testosterone_scores;
CREATE POLICY "testosterone_scores_update_own"
  ON testosterone_scores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "testosterone_scores_delete_own" ON testosterone_scores;
CREATE POLICY "testosterone_scores_delete_own"
  ON testosterone_scores
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
