-- ============================================
-- RENAME HEALTH POTION -> IMMUNITY POTION, REPRICE POTIONS
-- Run this in your Supabase SQL Editor.
--
-- Changes:
--   * Health Potion       -> Immunity Potion, 150 gold, 24h immunity (attacks + heists)
--   * Super Potion        -> 500 gold, 5 day immunity (attacks + heists)
--
-- Duration is enforced client-side in lib/shop.ts (useItem):
-- Super Potion = 120h, anything else = 24h. Only the name+cost+description
-- live in shop_items.
-- ============================================

UPDATE shop_items
SET name = 'Immunity Potion',
    cost = 150,
    effect = '{"description": "24h immunity from attacks and heists"}'::jsonb
WHERE name = 'Health Potion' AND type = 'potion';

UPDATE shop_items
SET cost = 500,
    effect = '{"description": "5 day immunity from attacks and heists"}'::jsonb
WHERE name = 'Super Potion' AND type = 'potion';

-- Verify
SELECT name, type, cost, effect
FROM shop_items
WHERE type = 'potion'
ORDER BY cost;
