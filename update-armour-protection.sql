-- ============================================
-- UPDATE ARMOUR PROTECTION VALUES
-- Run this in your Supabase SQL Editor
-- ============================================

-- Update armour items with protection values
UPDATE shop_items
SET effect = '{"description": "Blocks 5 EXP damage per attack", "protection": 5}'
WHERE name = 'Leather Armour';

UPDATE shop_items
SET effect = '{"description": "Blocks 15 EXP damage per attack", "protection": 15}'
WHERE name = 'Iron Armour';

UPDATE shop_items
SET effect = '{"description": "Blocks 30 EXP damage per attack", "protection": 30}'
WHERE name = 'Diamond Armour';

-- Update weapon items with damage values
UPDATE shop_items
SET effect = '{"description": "Deals 10 EXP damage", "damage": 10}'
WHERE name = 'Wooden Sword';

UPDATE shop_items
SET effect = '{"description": "Deals 25 EXP damage", "damage": 25}'
WHERE name = 'Iron Sword';

UPDATE shop_items
SET effect = '{"description": "Deals 50 EXP damage", "damage": 50}'
WHERE name = 'Diamond Sword';

-- Verify updates
SELECT name, type, effect
FROM shop_items
WHERE type IN ('armour', 'weapon')
ORDER BY type, cost;

