-- ============================================
-- ADD DAILY TASK COMPLETION COUNTER
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add column to track how many tasks have been completed today
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tasks_completed_today INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN profiles.tasks_completed_today IS 'Number of tasks completed today (resets daily at 5pm EST). Max 10 per day.';

