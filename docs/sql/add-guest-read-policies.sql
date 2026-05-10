-- Allow anonymous (guest) users to read public/browseable tables.
-- Run this in the Supabase SQL editor once.
--
-- Background: several existing RLS policies use `auth.uid() IS NOT NULL`
-- or `TO authenticated`, which blocks the `anon` role. Guest mode in the
-- app browses without signing in, so these reads return empty and the
-- corresponding pages look broken.
--
-- This migration adds an additional, anon-friendly SELECT policy beside
-- each existing one. It does NOT remove or weaken any other policy, and
-- it does not grant any write access. Authenticated users keep working
-- exactly as before.

-- ── Calendar: public daily leaderboard snapshots ──────────────────────
DROP POLICY IF EXISTS "Anyone can view leaderboard snapshots" ON daily_leaderboard_snapshots;
CREATE POLICY "Anyone can view leaderboard snapshots"
  ON daily_leaderboard_snapshots
  FOR SELECT
  USING (true);

-- ── Lift profiles (sidebar of lifters) ────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view lift profiles" ON lift_profiles;
CREATE POLICY "Anyone can view lift profiles"
  ON lift_profiles
  FOR SELECT
  USING (true);

-- ── Core lifts metadata + submissions ─────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view core lifts" ON core_lifts;
CREATE POLICY "Anyone can view core lifts"
  ON core_lifts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view core lift submissions" ON core_lift_submissions;
CREATE POLICY "Anyone can view core lift submissions"
  ON core_lift_submissions
  FOR SELECT
  USING (true);

-- ── Weekly lift leaderboards + submissions ────────────────────────────
DROP POLICY IF EXISTS "Anyone can view lift leaderboards" ON lift_leaderboards;
CREATE POLICY "Anyone can view lift leaderboards"
  ON lift_leaderboards
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view lift submissions" ON lift_submissions;
CREATE POLICY "Anyone can view lift submissions"
  ON lift_submissions
  FOR SELECT
  USING (true);

-- ── Ten T Commandments leaderboard ────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view testosterone scores" ON testosterone_scores;
CREATE POLICY "Anyone can view testosterone scores"
  ON testosterone_scores
  FOR SELECT
  USING (true);
