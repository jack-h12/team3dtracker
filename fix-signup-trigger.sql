-- ============================================
-- FIX SIGNUP ISSUE: Remove problematic triggers
-- Run this if you're getting "Database error saving new user"
-- ============================================

-- Check if there's a trigger that's causing issues
-- First, let's see what triggers exist on auth.users
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- If you see a trigger like "on_auth_user_created", drop it:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Also drop the function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================
-- Make sure profiles table exists and has correct RLS
-- ============================================

-- Ensure profiles table exists
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_level INTEGER DEFAULT 0,
  lifetime_exp INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the insert policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Make sure users can view all profiles (for leaderboard)
DROP POLICY IF EXISTS "Anyone can view all profiles" ON profiles;
CREATE POLICY "Anyone can view all profiles" ON profiles
  FOR SELECT USING (true);

-- Make sure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

