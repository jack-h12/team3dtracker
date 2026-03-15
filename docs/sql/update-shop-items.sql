-- ============================================
-- UPDATE SHOP ITEMS
-- Run this to update existing items in your database
-- ============================================

-- Update existing armour names
UPDATE shop_items SET name = 'Leather Armour' WHERE name = 'Iron Armour' AND cost = 100;
UPDATE shop_items SET name = 'Iron Armour' WHERE name = 'Steel Armour';

-- Add Diamond Sword if it doesn't exist
INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Diamond Sword', 'weapon', 300, '{"description": "Reduces target EXP by 50"}')
ON CONFLICT DO NOTHING;

-- Add Diamond Armour if it doesn't exist
INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Diamond Armour', 'armour', 500, '{"description": "Maximum protection from attacks"}')
ON CONFLICT DO NOTHING;

-- If you still have "Steel Armour" and want it to use diamond icon, you can either:
-- Option 1: Rename it to Diamond Armour
-- UPDATE shop_items SET name = 'Diamond Armour' WHERE name = 'Steel Armour';

-- Option 2: Keep it as Steel Armour (the code will map it to diamond icon automatically)

