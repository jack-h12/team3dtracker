-- ============================================
-- CLEANUP DUPLICATE SHOP ITEMS
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script will:
-- 1. Find duplicate shop items by name
-- 2. Keep the oldest one (lowest ID or earliest created_at)
-- 3. Update user_inventory to point to the kept item
-- 4. Delete the duplicate items
-- ============================================

-- Step 1: Update user_inventory to point to the kept items (lowest id)
UPDATE user_inventory ui
SET item_id = (
  SELECT si2.id
  FROM shop_items si2
  WHERE si2.name = (SELECT name FROM shop_items WHERE id = ui.item_id)
  ORDER BY si2.id ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM shop_items si
  WHERE si.id = ui.item_id
    AND si.id NOT IN (
      SELECT DISTINCT ON (name) id
      FROM shop_items
      ORDER BY name, id ASC
    )
);

-- Step 2: Delete duplicate items (keeps the one with lowest id for each name)
DELETE FROM shop_items
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM shop_items
  ORDER BY name, id ASC
);

-- ============================================
-- VERIFY: Check remaining shop items
-- ============================================
-- Run this to see what items remain:
-- SELECT id, name, type, cost FROM shop_items ORDER BY name;

-- ============================================
-- ALTERNATIVE: Manual cleanup (if above doesn't work)
-- ============================================
-- If you want to manually delete specific duplicates, first check what you have:
-- SELECT id, name, type, cost, created_at 
-- FROM shop_items 
-- ORDER BY name, created_at;

-- Then delete specific duplicates by ID (keep the one you want):
-- DELETE FROM shop_items WHERE id = 'duplicate-item-id-here';

