-- ============================================
-- VIEW ALL SHOP ITEMS
-- Run this to see all shop items and identify duplicates
-- ============================================

-- View all shop items with counts
SELECT 
  name,
  type,
  cost,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as item_ids,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM shop_items
GROUP BY name, type, cost
ORDER BY name;

-- View detailed list of all items
SELECT 
  id,
  name,
  type,
  cost,
  effect,
  created_at
FROM shop_items
ORDER BY name, created_at;

-- Find items that appear more than once
SELECT 
  name,
  COUNT(*) as count
FROM shop_items
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

