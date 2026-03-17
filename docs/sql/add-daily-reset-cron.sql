-- ============================================
-- ADD AUTOMATIC DAILY RESET AT 5PM EST
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script creates:
-- 1. A function that resets all users' daily progress
-- 2. A pg_cron job that runs this function daily at 5pm EST/EDT
--
-- The function checks if it's currently 5pm Eastern Time before executing,
-- ensuring it runs at the correct time regardless of DST changes.

-- ============================================
-- Step 1: Enable pg_cron extension (if not already enabled)
-- ============================================
-- Note: This may require superuser privileges. If you get an error,
-- you may need to enable it through Supabase dashboard or contact support.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- Step 2: Create a table to track last reset time
-- ============================================
-- This prevents the reset from running multiple times in the same day
CREATE TABLE IF NOT EXISTS daily_reset_log (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Only one row
  last_reset_date DATE NOT NULL,
  last_reset_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row if it doesn't exist
INSERT INTO daily_reset_log (id, last_reset_date, last_reset_timestamp)
VALUES (1, CURRENT_DATE - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 3: Function to reset all daily progress
-- ============================================
-- This function resets daily progress for ALL users
-- It checks if it's 5pm Eastern and if we haven't already reset today
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
  -- NOW() returns UTC timestamptz, AT TIME ZONE converts it to Eastern Time as timestamp
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
    
    -- Clean up expired armour from all users' inventories
    DELETE FROM user_inventory
    WHERE expires_at IS NOT NULL AND expires_at <= NOW();

    -- Update the reset log
    UPDATE daily_reset_log
    SET 
      last_reset_date = current_eastern_date,
      last_reset_timestamp = NOW()
    WHERE id = 1;
    
    -- Log the reset
    RAISE NOTICE 'Daily reset executed at % Eastern Time on %', 
      current_eastern_time, current_eastern_date;
  ELSE
    -- Log that reset was skipped
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

-- ============================================
-- Step 4: Schedule the cron job
-- ============================================
-- We'll schedule the job to run every hour, and the function will check
-- if it's actually 5pm Eastern Time before executing the reset.
-- This ensures it works correctly during both EST and EDT periods.

-- Remove any existing cron job with the same name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-reset-5pm-est') THEN
    PERFORM cron.unschedule('daily-reset-5pm-est');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if unschedule fails
  NULL;
END $$;

-- Schedule job to run every hour at minute 0
-- The function will only execute the reset when it's actually 5pm Eastern
SELECT cron.schedule(
  'daily-reset-5pm-est',  -- Job name
  '0 * * * *',            -- Cron schedule: Every hour at minute 0
  $$SELECT reset_all_daily_progress_automatic();$$
);


-- ============================================
-- Verify the cron job was created
-- ============================================
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'daily-reset-5pm-est';

-- ============================================
-- Useful commands for managing cron jobs:
-- ============================================
-- View all cron jobs:
-- SELECT * FROM cron.job;

-- View cron job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Remove the cron job:
-- SELECT cron.unschedule('daily-reset-5pm-est');

-- Manually test the function:
-- SELECT reset_all_daily_progress_automatic();

