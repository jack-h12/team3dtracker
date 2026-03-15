-- ============================================
-- ADD ADMIN CREATIVE MODE FUNCTIONS
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script creates database functions that allow admins to:
-- - Update user stats (gold, EXP, level, username)
-- - Delete users and their data
-- - Delete user tasks
-- - Reset user data
--
-- These functions use SECURITY DEFINER to bypass RLS,
-- but they check admin status in the application code.

-- ============================================
-- 1. Function to update user gold (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_update_user_gold(
  target_user_id UUID,
  new_gold INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_gold < 0 THEN
    RAISE EXCEPTION 'Gold cannot be negative';
  END IF;
  
  UPDATE profiles
  SET gold = new_gold
  WHERE id = target_user_id;
END;
$$;

-- ============================================
-- 2. Function to update user EXP (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_update_user_exp(
  target_user_id UUID,
  new_exp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_exp < 0 THEN
    RAISE EXCEPTION 'EXP cannot be negative';
  END IF;
  
  UPDATE profiles
  SET lifetime_exp = new_exp
  WHERE id = target_user_id;
END;
$$;

-- ============================================
-- 3. Function to update user level (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_update_user_level(
  target_user_id UUID,
  new_level INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_level < 0 OR new_level > 10 THEN
    RAISE EXCEPTION 'Level must be between 0 and 10';
  END IF;
  
  UPDATE profiles
  SET avatar_level = new_level
  WHERE id = target_user_id;
END;
$$;

-- ============================================
-- 4. Function to update username (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_update_username(
  target_user_id UUID,
  new_username TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_username IS NULL OR TRIM(new_username) = '' THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;
  
  IF LENGTH(new_username) > 50 THEN
    RAISE EXCEPTION 'Username must be 50 characters or less';
  END IF;
  
  -- Check if username is already taken by another user
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE username = TRIM(new_username) 
    AND id != target_user_id
  ) THEN
    RAISE EXCEPTION 'Username is already taken';
  END IF;
  
  UPDATE profiles
  SET username = TRIM(new_username)
  WHERE id = target_user_id;
END;
$$;

-- ============================================
-- 5. Function to delete user tasks (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_delete_user_tasks(
  target_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM tasks
  WHERE user_id = target_user_id;
END;
$$;

-- ============================================
-- 6. Function to reset user data (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_reset_user_data(
  target_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all tasks
  DELETE FROM tasks WHERE user_id = target_user_id;
  
  -- Reset level and tasks completed
  UPDATE profiles
  SET 
    avatar_level = 0,
    tasks_completed_today = 0
  WHERE id = target_user_id;
END;
$$;

-- ============================================
-- 7. Function to delete user (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION admin_delete_user(
  target_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete user tasks
  DELETE FROM tasks WHERE user_id = target_user_id;
  
  -- Delete user inventory
  DELETE FROM user_inventory WHERE user_id = target_user_id;
  
  -- Delete friend requests (both sent and received)
  DELETE FROM friend_requests 
  WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  
  -- Delete profile (this will cascade to auth.users if foreign key is set up)
  DELETE FROM profiles WHERE id = target_user_id;
END;
$$;

-- ============================================
-- Grant execute permissions to authenticated users
-- (Admin check is done in application code)
-- ============================================
GRANT EXECUTE ON FUNCTION admin_update_user_gold(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_exp(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_level(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_username(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user_tasks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;

-- ============================================
-- Verify functions were created
-- ============================================
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'admin_%'
ORDER BY routine_name;

-- ============================================
-- OPTIONAL: Add RLS policy to allow admins to update any profile
-- (Alternative approach - you can use this instead of functions)
-- ============================================
-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Create policy that allows admins to update any profile
CREATE POLICY "Admins can update any profile"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  )
);

-- Also allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;

CREATE POLICY "Admins can delete any profile"
ON profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  )
);

-- ============================================
-- OPTIONAL: Allow admins to delete tasks
-- ============================================
DROP POLICY IF EXISTS "Admins can delete any tasks" ON tasks;

CREATE POLICY "Admins can delete any tasks"
ON tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  )
);

-- ============================================
-- Done! Admin creative mode functions are ready.
-- ============================================

