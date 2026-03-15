-- ============================================
-- FIX: Allow viewing other users' inventory in leaderboard
-- Run this in your Supabase SQL Editor
-- ============================================
-- This adds a policy to allow anyone to view inventory from any user
-- (needed for the leaderboard profile view feature)

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view all inventory" ON user_inventory;

-- Create policy that allows anyone to view all inventory
-- (This is needed so users can see other users' inventory in the leaderboard)
CREATE POLICY "Anyone can view all inventory" ON user_inventory
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
WHERE tablename = 'user_inventory'
ORDER BY policyname;

-- ============================================
-- Note: The existing "Users can manage own inventory" policy still applies
-- for INSERT, UPDATE, DELETE operations, so users can only modify their own inventory.
-- This new policy only allows SELECT (viewing) any user's inventory.
-- ============================================

