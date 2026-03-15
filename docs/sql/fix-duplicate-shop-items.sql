-- ============================================
-- FIX DUPLICATE SHOP ITEMS
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script will:
-- 1. First show you what duplicates exist
-- 2. Update user_inventory to point to the kept items (oldest by ID)
-- 3. Delete the duplicate items
-- ============================================

-- STEP 1: View duplicates (run this first to see what you have)
SELECT 
  name,
  type,
  cost,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY id) as all_ids
FROM shop_items
GROUP BY name, type, cost
HAVING COUNT(*) > 1
ORDER BY name;

-- STEP 2: Update user_inventory to point to the kept items (lowest ID for each name)
-- This ensures no one loses their items when we delete duplicates
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

-- STEP 3: Delete duplicate items (keeps the one with lowest ID for each name)
DELETE FROM shop_items
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM shop_items
  ORDER BY name, id ASC
);

-- STEP 4: Verify - check remaining items (should show no duplicates)
SELECT 
  name,
  type,
  cost,
  COUNT(*) as count
FROM shop_items
GROUP BY name, type, cost
HAVING COUNT(*) > 1
ORDER BY name;

-- If the above returns no rows, all duplicates are removed!
-- If it still shows duplicates, there might be items with same name but different cost/type
-- In that case, run the detailed view below:

-- DETAILED VIEW: See all items
SELECT id, name, type, cost, effect
FROM shop_items
ORDER BY name, id;

