-- ============================================
-- MANUAL CLEANUP OF DUPLICATE SHOP ITEMS
-- Use this if the automatic cleanup doesn't work
-- ============================================
-- 
-- STEP 1: First, run view-shop-items.sql to see what duplicates you have
-- 
-- STEP 2: For each duplicate, decide which one to keep (usually the oldest)
-- 
-- STEP 3: Update user_inventory to point to the item you're keeping
-- 
-- STEP 4: Delete the duplicates
-- ============================================

-- Example: If you have duplicate "Wooden Sword" items
-- Replace the IDs below with your actual duplicate IDs

-- Step 1: Find the ID you want to keep (the oldest one)
-- SELECT id, name, created_at FROM shop_items WHERE name = 'Wooden Sword' ORDER BY created_at LIMIT 1;

-- Step 2: Update inventory to point to the kept item
-- UPDATE user_inventory 
-- SET item_id = 'KEEP-THIS-ID-HERE'
-- WHERE item_id IN ('DELETE-ID-1', 'DELETE-ID-2', 'DELETE-ID-3');

-- Step 3: Delete the duplicates
-- DELETE FROM shop_items WHERE id IN ('DELETE-ID-1', 'DELETE-ID-2', 'DELETE-ID-3');

-- ============================================
-- SPECIFIC CLEANUP FOR COMMON DUPLICATES
-- ============================================

-- Clean up duplicate weapons
WITH weapon_duplicates AS (
  SELECT name, MIN(id) as keep_id, array_agg(id) as all_ids
  FROM shop_items
  WHERE type IN ('weapon', 'armour')
  GROUP BY name
  HAVING COUNT(*) > 1
)
SELECT * FROM weapon_duplicates;

-- Clean up duplicate name change items
WITH name_change_duplicates AS (
  SELECT name, MIN(id) as keep_id, array_agg(id) as all_ids
  FROM shop_items
  WHERE type IN ('name_change', 'name_restore')
  GROUP BY name
  HAVING COUNT(*) > 1
)
SELECT * FROM name_change_duplicates;

-- ============================================
-- SAFE DELETE (only deletes if no inventory references)
-- ============================================
-- This will only delete items that aren't in anyone's inventory
-- DELETE FROM shop_items 
-- WHERE id IN (
--   SELECT si.id 
--   FROM shop_items si
--   LEFT JOIN user_inventory ui ON ui.item_id = si.id
--   WHERE ui.id IS NULL
--   AND si.id NOT IN (
--     SELECT DISTINCT ON (name) id
--     FROM shop_items
--     ORDER BY name, created_at
--   )
-- );

