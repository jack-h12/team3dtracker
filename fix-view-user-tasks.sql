-- ============================================
-- FIX: Allow viewing other users' tasks in leaderboard
-- Run this in your Supabase SQL Editor
-- ============================================
-- This adds a policy to allow anyone to view tasks from any user
-- (needed for the leaderboard profile view feature)

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view all tasks" ON tasks;

-- Create policy that allows anyone to view all tasks
-- (This is needed so users can see other users' tasks in the leaderboard)
CREATE POLICY "Anyone can view all tasks" ON tasks
  FOR SELECT
  USING (true);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'tasks'
ORDER BY policyname;

-- ============================================
-- Note: The existing "Users can manage own tasks" policy still applies
-- for INSERT, UPDATE, DELETE operations, so users can only modify their own tasks.
-- This new policy only allows SELECT (viewing) any user's tasks.
-- ============================================

