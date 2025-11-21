-- ============================================
-- SET INITIAL ADMIN USER
-- Run this in your Supabase SQL Editor
-- ============================================
-- 
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users
-- You can find your user ID by:
-- 1. Going to Authentication > Users in Supabase dashboard
-- 2. Or checking the browser console when logged in (user.id)
-- 3. Or running: SELECT id, email FROM auth.users;
--
-- ============================================

-- Option 1: Set admin by user ID (replace with your actual UUID)
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_USER_ID_HERE';

-- Option 2: Set admin by email (replace with your email)
-- UPDATE profiles SET is_admin = TRUE 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- Option 3: Set admin for the first user (if you're the first one to sign up)
-- UPDATE profiles SET is_admin = TRUE 
-- WHERE id = (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1);

-- Option 4: Set admin for all users with a specific username pattern (be careful!)
-- UPDATE profiles SET is_admin = TRUE WHERE username LIKE '%admin%';

-- ============================================
-- RECOMMENDED: Use Option 1 or 2
-- ============================================

-- Example (uncomment and replace with your values):
-- UPDATE profiles SET is_admin = TRUE WHERE id = '123e4567-e89b-12d3-a456-426614174000';

