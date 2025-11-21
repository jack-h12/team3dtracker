-- ============================================
-- REMOVE THE PROBLEMATIC TRIGGER
-- This will fix the "Database error saving new user" issue
-- ============================================

-- Remove the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- That's it! Now your app will create profiles manually through the code.

