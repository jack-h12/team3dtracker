-- ============================================
-- UPDATE ARMOUR PROTECTION VALUES
-- Run this in your Supabase SQL Editor
-- ============================================

-- Update armour items with protection values
UPDATE shop_items
SET effect = '{"description": "Blocks 15 EXP damage per attack", "protection": 15}'
WHERE name = 'Leather Armour';

UPDATE shop_items
SET effect = '{"description": "Blocks 60 EXP damage per attack", "protection": 60}'
WHERE name = 'Iron Armour';

UPDATE shop_items
SET effect = '{"description": "Blocks 125 EXP damage per attack", "protection": 125}'
WHERE name = 'Diamond Armour';

-- Update weapon items with damage values
UPDATE shop_items
SET effect = '{"description": "Deals 30 EXP damage", "damage": 30}'
WHERE name = 'Wooden Sword';

UPDATE shop_items
SET effect = '{"description": "Deals 120 EXP damage", "damage": 120}'
WHERE name = 'Iron Sword';

UPDATE shop_items
SET effect = '{"description": "Deals 250 EXP damage", "damage": 250}'
WHERE name = 'Diamond Sword';

-- Verify updates
SELECT name, type, effect
FROM shop_items
WHERE type IN ('armour', 'weapon')
ORDER BY type, cost;

