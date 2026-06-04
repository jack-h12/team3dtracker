-- ============================================
-- FIX: Item Steal "no items to steal" bug
-- Run this in your Supabase SQL Editor.
--
-- Root cause: list_steal_target_inventory declares its result columns as
-- (cost INTEGER, quantity INTEGER), but in this database shop_items.cost is
-- actually BIGINT. Postgres RETURN QUERY enforces an exact structural match, so
-- the function threw 42804 ("Returned type bigint does not match expected type
-- integer in column 5") whenever it actually ran (i.e. for an authenticated
-- caller — anonymous calls early-returned before the query). The client caught
-- the 400 and silently showed "This player has no items to steal."
--
-- Fix: cast the numeric columns to int in the SELECT so the returned structure
-- matches the declared signature no matter what the underlying column types are.
-- (Item costs/quantities are tiny, so the cast is lossless.)
-- ============================================

CREATE OR REPLACE FUNCTION list_steal_target_inventory(p_target_id UUID)
RETURNS TABLE (
  inventory_id UUID,
  item_id UUID,
  name TEXT,
  type TEXT,
  cost INTEGER,
  quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_target_id = auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ui.id, ui.item_id, si.name::text, si.type::text, si.cost::int, ui.quantity::int
    FROM user_inventory ui
    JOIN shop_items si ON si.id = ui.item_id
    WHERE ui.user_id = p_target_id
      -- hide expired armour (it's effectively gone)
      AND NOT (si.type = 'armour' AND ui.expires_at IS NOT NULL AND ui.expires_at <= NOW())
    ORDER BY si.cost DESC, si.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_steal_target_inventory(UUID) TO authenticated;
