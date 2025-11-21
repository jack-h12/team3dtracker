-- ============================================
-- SIMPLE CLEANUP DUPLICATE SHOP ITEMS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: Update user_inventory to point to the kept items
-- (keeps the item with lowest id for each name)
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

-- Step 3: Verify - check remaining items
SELECT name, type, cost, COUNT(*) as count
FROM shop_items
GROUP BY name, type, cost
ORDER BY name;

