-- ============================================
-- INCREASE POTION PRICES (TOO OVERPOWERED)
-- Run this in your Supabase SQL Editor
-- ============================================

-- Update Health Potion price (24h immunity) - increased from 75 to 400 gold
UPDATE shop_items
SET cost = 400
WHERE name = 'Health Potion' AND type = 'potion';

-- Update Super Potion price (48h immunity) - increased from 200 to 800 gold
UPDATE shop_items
SET cost = 800
WHERE name = 'Super Potion' AND type = 'potion';

-- Verify updates
SELECT name, type, cost, effect
FROM shop_items
WHERE type = 'potion'
ORDER BY cost;

