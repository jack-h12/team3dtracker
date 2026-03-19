-- ============================================
-- CALENDAR / HISTORY SNAPSHOTS
-- Creates tables to store daily task and leaderboard snapshots
-- so users can view their history via the Calendar feature.
-- ============================================

-- 1. Daily task snapshots - stores each user's tasks at end of day
CREATE TABLE IF NOT EXISTS daily_task_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  description TEXT NOT NULL,
  reward TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  task_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily leaderboard snapshots - stores the final rankings each day
CREATE TABLE IF NOT EXISTS daily_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_level INTEGER DEFAULT 0,
  tasks_completed_today INTEGER DEFAULT 0,
  completed_all_tasks_at TIMESTAMP WITH TIME ZONE,
  lifetime_exp INTEGER DEFAULT 0,
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying by date and user
CREATE INDEX IF NOT EXISTS idx_task_snapshots_user_date
  ON daily_task_snapshots(user_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date
  ON daily_leaderboard_snapshots(snapshot_date, rank);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_user
  ON daily_leaderboard_snapshots(user_id, snapshot_date);

-- Enable RLS
ALTER TABLE daily_task_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can view their own task snapshots
DROP POLICY IF EXISTS "Users can view own task snapshots" ON daily_task_snapshots;
CREATE POLICY "Users can view own task snapshots" ON daily_task_snapshots
  FOR SELECT USING (auth.uid() = user_id);

-- RLS policies: all authenticated users can view leaderboard snapshots
DROP POLICY IF EXISTS "Authenticated users can view leaderboard snapshots" ON daily_leaderboard_snapshots;
CREATE POLICY "Authenticated users can view leaderboard snapshots" ON daily_leaderboard_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);
