-- ============================================
-- SIMPLE RLS FIX - Try this if the other one didn't work
-- ============================================

-- First, make sure the profiles table exists
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_level INTEGER DEFAULT 0,
  lifetime_exp INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON profiles';
    END LOOP;
END $$;

-- Now create the policies with SECURITY DEFINER to bypass RLS during creation
-- This is important for the insert policy

-- Policy 1: Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policy 2: Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy 3: Allow users to update their own profile  
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Allow anyone to view all profiles (for leaderboard)
CREATE POLICY "Anyone can view all profiles" ON profiles
  FOR SELECT 
  USING (true);

-- Verify policies were created
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

