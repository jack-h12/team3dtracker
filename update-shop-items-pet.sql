-- ============================================
-- UPDATE SHOP ITEMS: Remove clothes, Add Pet Gorilla
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: First, delete inventory entries that reference clothes items
DELETE FROM user_inventory 
WHERE item_id IN (
  SELECT id FROM shop_items 
  WHERE type = 'clothes' OR name IN ('Cool Hat', 'Epic Cape')
);

-- Step 2: Now remove Cool Hat and Epic Cape from shop_items
DELETE FROM shop_items 
WHERE name IN ('Cool Hat', 'Epic Cape');

-- Step 3: Also delete any other clothes items that might exist
DELETE FROM shop_items 
WHERE type = 'clothes';

-- Step 3: Now update the shop_items table to allow 'pet' type instead of 'clothes'
ALTER TABLE shop_items 
  DROP CONSTRAINT IF EXISTS shop_items_type_check;

ALTER TABLE shop_items 
  ADD CONSTRAINT shop_items_type_check 
  CHECK (type IN ('armour', 'weapon', 'potion', 'pet', 'name_change', 'name_restore'));

-- Step 4: Add Pet Gorilla (or update if it already exists)
INSERT INTO shop_items (name, type, cost, effect) 
VALUES ('Pet Gorilla', 'pet', 150, '{"description": "boi do absolutely nuthin 🤣"}')
ON CONFLICT (name) DO UPDATE 
SET effect = '{"description": "boi do absolutely nuthin 🤣"}';

-- If the item doesn't have a unique constraint on name, use this instead:
UPDATE shop_items 
SET effect = '{"description": "boi do absolutely nuthin 🤣"}'
WHERE name = 'Pet Gorilla';

-- Verify changes
SELECT name, type, cost, effect
FROM shop_items
ORDER BY type, cost;

