-- ============================================
-- CHECK AND ADD MISSING FEATURES
-- Run this to check what's missing and add it
-- ============================================

-- Step 1: Check current columns in profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Step 2: Add missing columns (safe to run multiple times)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS name_changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Step 3: Check existing shop items
SELECT name, type, cost, COUNT(*) as count
FROM shop_items
GROUP BY name, type, cost
ORDER BY name;

-- Step 4: Add missing shop items (only if they don't exist)
INSERT INTO shop_items (name, type, cost, effect) 
SELECT 'Name Change Scroll', 'name_change', 500, '{"description": "Change someone else''s displayed name"}'
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE name = 'Name Change Scroll' AND type = 'name_change'
);

INSERT INTO shop_items (name, type, cost, effect) 
SELECT 'Name Restore Scroll', 'name_restore', 200, '{"description": "Restore your own name back to original"}'
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE name = 'Name Restore Scroll' AND type = 'name_restore'
);

-- Step 5: Verify everything is set up
SELECT 
  'Profiles columns' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name_changed_by')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin')
    THEN '✓ All columns exist'
    ELSE '✗ Missing columns'
  END as status
UNION ALL
SELECT 
  'Shop items' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM shop_items WHERE name = 'Name Change Scroll')
      AND EXISTS (SELECT 1 FROM shop_items WHERE name = 'Name Restore Scroll')
    THEN '✓ All items exist'
    ELSE '✗ Missing items'
  END as status;

