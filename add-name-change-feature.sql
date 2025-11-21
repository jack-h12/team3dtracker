-- ============================================
-- ADD NAME CHANGE FEATURE
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add new columns to profiles table (if they don't exist)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS name_changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Add new shop items
INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Name Change Scroll', 'name_change', 500, '{"description": "Change someone else''s displayed name"}'),
  ('Name Restore Scroll', 'name_restore', 200, '{"description": "Restore your own name back to original"}')
ON CONFLICT DO NOTHING;

-- 3. Update RLS policies to allow updating display_name
-- (The existing UPDATE policy should already cover this, but verify it allows updating display_name and name_changed_by)

