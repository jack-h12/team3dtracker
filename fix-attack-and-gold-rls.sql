-- ============================================
-- FIX RLS FOR ATTACKS AND GOLD UPDATES
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create a function to update target's EXP (bypasses RLS)
CREATE OR REPLACE FUNCTION update_target_exp(
  target_user_id UUID,
  new_exp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET lifetime_exp = new_exp
  WHERE id = target_user_id;
END;
$$;

-- Create a function to update user's gold and EXP (bypasses RLS for task completion)
CREATE OR REPLACE FUNCTION update_user_gold_and_exp(
  user_id_param UUID,
  gold_increase INTEGER,
  exp_increase INTEGER,
  new_level INTEGER,
  tasks_completed_today INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    gold = gold + gold_increase,
    lifetime_exp = lifetime_exp + exp_increase,
    avatar_level = new_level,
    tasks_completed_today = COALESCE(tasks_completed_today, profiles.tasks_completed_today)
  WHERE id = user_id_param;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_target_exp(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_gold_and_exp(UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

-- Verify functions were created
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_target_exp', 'update_user_gold_and_exp');

