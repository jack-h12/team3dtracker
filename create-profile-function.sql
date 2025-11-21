-- ============================================
-- CREATE A FUNCTION TO HANDLE PROFILE CREATION
-- This function can bypass RLS during signup
-- ============================================

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT);

-- Create a function that creates a profile
-- SECURITY DEFINER allows it to bypass RLS
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_username TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the profile (this bypasses RLS because of SECURITY DEFINER)
  INSERT INTO profiles (id, username, avatar_level, lifetime_exp, gold)
  VALUES (user_id, user_username, 0, 0, 100)
  ON CONFLICT (id) DO UPDATE 
  SET username = EXCLUDED.username;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT) TO anon;

-- Test the function (optional - remove this after testing)
-- SELECT public.create_user_profile('00000000-0000-0000-0000-000000000000'::UUID, 'test');

