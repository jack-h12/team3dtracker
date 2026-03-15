-- ============================================
-- ADD completed_all_tasks_at COLUMN TO PROFILES
-- Run this in your Supabase SQL Editor
-- ============================================
-- This column tracks the timestamp when a user completes all 10 daily tasks.
-- It is used to rank the daily leaderboard: the first user to complete all
-- 10 tasks is #1, the second is #2, etc. It resets daily at 5pm EST.

-- Add the column (nullable, defaults to null = not yet completed all tasks today)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS completed_all_tasks_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================
-- Update the daily reset function to also clear completed_all_tasks_at
-- ============================================
CREATE OR REPLACE FUNCTION reset_all_daily_progress_automatic()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_eastern_timestamp TIMESTAMP;
  current_eastern_time TIME;
  current_eastern_date DATE;
  target_time TIME := '17:00:00'; -- 5pm Eastern
  time_tolerance INTERVAL := '10 minutes'; -- Allow 10 minute window
  last_reset_date DATE;
BEGIN
  -- Get current timestamp in Eastern Timezone (handles EST/EDT automatically)
  current_eastern_timestamp := (NOW() AT TIME ZONE 'America/New_York');
  current_eastern_time := current_eastern_timestamp::TIME;
  current_eastern_date := current_eastern_timestamp::DATE;

  -- Get the last reset date
  SELECT last_reset_date INTO last_reset_date FROM daily_reset_log WHERE id = 1;

  -- Only execute if:
  -- 1. It's within the time window (5pm ± 10 minutes)
  -- 2. We haven't already reset today
  IF current_eastern_time >= target_time - time_tolerance
     AND current_eastern_time <= target_time + time_tolerance
     AND (last_reset_date IS NULL OR last_reset_date < current_eastern_date) THEN

    -- Delete all tasks for all users
    DELETE FROM tasks;

    -- Reset avatar_level, tasks_completed_today, and completed_all_tasks_at for all users
    UPDATE profiles
    SET
      avatar_level = 0,
      tasks_completed_today = 0,
      completed_all_tasks_at = NULL;

    -- Update the reset log
    UPDATE daily_reset_log
    SET
      last_reset_date = current_eastern_date,
      last_reset_timestamp = NOW()
    WHERE id = 1;

    RAISE NOTICE 'Daily reset executed at % Eastern Time on %',
      current_eastern_time, current_eastern_date;
  ELSE
    IF last_reset_date >= current_eastern_date THEN
      RAISE NOTICE 'Daily reset skipped - already reset today (last reset: %)', last_reset_date;
    ELSE
      RAISE NOTICE 'Daily reset skipped - current time is % Eastern (target: 5pm ± 10min)',
        current_eastern_time;
    END IF;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_all_daily_progress_automatic() TO postgres;
