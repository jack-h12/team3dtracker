-- ============================================
-- ADD ADMIN RESET ALL DAILY PROGRESS FUNCTION
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script creates a database function that allows admins to:
-- - Reset daily progress for ALL users at once
-- - Delete all tasks for all users
-- - Reset avatar_level and tasks_completed_today to 0 for all users
--
-- This function uses SECURITY DEFINER to bypass RLS,
-- but admin check is done in the application code.

-- ============================================
-- Function to reset daily progress for all users (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_reset_all_daily_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all tasks for all users
  DELETE FROM tasks;
  
  -- Reset avatar_level and tasks_completed_today for all users
  UPDATE profiles
  SET 
    avatar_level = 0,
    tasks_completed_today = 0;
END;
$$;

-- ============================================
-- Grant execute permissions to authenticated users
-- (Admin check is done in application code)
-- ============================================
GRANT EXECUTE ON FUNCTION admin_reset_all_daily_progress() TO authenticated;

-- ============================================
-- Verify function was created
-- ============================================
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'admin_reset_all_daily_progress';

