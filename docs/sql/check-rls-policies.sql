-- ============================================
-- CHECK IF RLS POLICIES EXIST
-- Run this to see what policies are currently on the profiles table
-- ============================================

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- List all policies on profiles table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as "Command",
  qual as "Using Expression",
  with_check as "With Check Expression"
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- If you see no results, the policies don't exist!

