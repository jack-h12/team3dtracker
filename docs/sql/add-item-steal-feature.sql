-- ============================================
-- ITEM STEAL FEATURE
-- Run this in your Supabase SQL Editor.
--
-- Adds:
--   * 'item_steal' shop item type + one shop row (50 gold)
--   * item_steal_attempts table (one attempt per 24h, history/transparency)
--   * item_steal_notifications table (results surfaced to thief + target)
--   * list_steal_target_inventory() RPC  (pick which of a target's items to steal)
--   * attempt_item_steal() RPC           (atomic 50/50 resolve)
--
-- Mechanics:
--   * 50% chance to steal the targeted item from another player.
--   * On success the item moves to your inventory.
--   * On failure you pay the target the item's worth (its shop cost).
--   * You may only attempt a steal you can afford to lose (gold >= worth).
--   * One steal attempt per 24 hours (like bankrob).
-- ============================================

-- ---- shop_items: add 'item_steal' to the allowed type set ----
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shop_items' AND constraint_name = 'shop_items_type_check'
  ) THEN
    ALTER TABLE shop_items DROP CONSTRAINT shop_items_type_check;
  END IF;
END$$;

ALTER TABLE shop_items
  ADD CONSTRAINT shop_items_type_check
  CHECK (type IN ('armour','weapon','potion','pet','name_change','name_restore','display_name_restore','bankrob','item_steal'));

-- ---- Seed one item_steal shop item (idempotent) ----
INSERT INTO shop_items (name, type, cost, effect)
SELECT
  'Item Steal',
  'item_steal',
  50,
  '{"description":"Target another player''s item. 50% chance to steal it. Fail and you pay them what it''s worth — so you must hold enough gold to cover it. One attempt per day.","base_odds":50}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE type = 'item_steal');

-- Keep an existing row in sync on re-run (idempotent)
UPDATE shop_items
SET cost = 50,
    effect = '{"description":"Target another player''s item. 50% chance to steal it. Fail and you pay them what it''s worth — so you must hold enough gold to cover it. One attempt per day.","base_odds":50}'::jsonb
WHERE type = 'item_steal';

-- ---- item_steal_attempts ----
CREATE TABLE IF NOT EXISTS item_steal_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thief_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_inventory_id UUID,        -- the targeted inventory row (may be gone after a successful steal)
  item_id UUID,                    -- the shop item that was targeted
  item_name TEXT,
  item_worth INTEGER,
  success BOOLEAN,
  gold_paid INTEGER DEFAULT 0,     -- gold paid to target on failure
  roll INTEGER,                    -- 1..100 RNG roll, for transparency
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_steal_attempts_thief ON item_steal_attempts(thief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_steal_attempts_target ON item_steal_attempts(target_id, created_at DESC);

ALTER TABLE item_steal_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read steal attempts you're involved in" ON item_steal_attempts;
CREATE POLICY "Read steal attempts you're involved in" ON item_steal_attempts FOR SELECT
  USING (auth.uid() = thief_id OR auth.uid() = target_id);
-- All writes happen via SECURITY DEFINER functions; no direct write policy.

-- ---- item_steal_notifications ----
CREATE TABLE IF NOT EXISTS item_steal_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  attempt_id UUID REFERENCES item_steal_attempts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('steal_won','steal_lost','item_stolen','thief_paid')),
  message TEXT NOT NULL,
  gold_delta INTEGER DEFAULT 0,
  item_name TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_steal_notifications_user ON item_steal_notifications(user_id, is_read, created_at DESC);

ALTER TABLE item_steal_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own item steal notifications" ON item_steal_notifications;
CREATE POLICY "Read own item steal notifications" ON item_steal_notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Update own item steal notifications" ON item_steal_notifications;
CREATE POLICY "Update own item steal notifications" ON item_steal_notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Delete own item steal notifications" ON item_steal_notifications;
CREATE POLICY "Delete own item steal notifications" ON item_steal_notifications FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RPC: list_steal_target_inventory
-- Lets the thief see which of a target's items they could steal.
-- SECURITY DEFINER so it bypasses the "read only your own inventory" RLS.
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
    SELECT ui.id, ui.item_id, si.name, si.type, si.cost, ui.quantity
    FROM user_inventory ui
    JOIN shop_items si ON si.id = ui.item_id
    WHERE ui.user_id = p_target_id
      -- hide expired armour (it's effectively gone)
      AND NOT (si.type = 'armour' AND ui.expires_at IS NOT NULL AND ui.expires_at <= NOW())
    ORDER BY si.cost DESC, si.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_steal_target_inventory(UUID) TO authenticated;

-- ============================================
-- RPC: attempt_item_steal
-- Consumes one item_steal, rolls 50/50, and either moves the item or
-- pays the target the item's worth. Atomic.
-- ============================================
CREATE OR REPLACE FUNCTION attempt_item_steal(
  p_thief_id UUID,
  p_steal_inventory_id UUID,
  p_target_inventory_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_steal_qty INTEGER;
  v_steal_type TEXT;
  v_steal_owner UUID;
  v_target_id UUID;
  v_target_qty INTEGER;
  v_target_item_id UUID;
  v_target_expires TIMESTAMP WITH TIME ZONE;
  v_item_name TEXT;
  v_item_type TEXT;
  v_worth INTEGER;
  v_thief_gold INTEGER;
  v_target_potion TIMESTAMP WITH TIME ZONE;
  v_thief_name TEXT;
  v_target_name TEXT;
  v_base_odds INTEGER := 50;
  v_roll INTEGER;
  v_success BOOLEAN;
  v_recent INTEGER;
  v_attempt_id UUID;
  v_existing_inv UUID;
  v_existing_qty INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_thief_id THEN
    RAISE EXCEPTION 'Not authorised to steal as another user';
  END IF;

  -- 24h cooldown (one attempt per day)
  SELECT COUNT(*) INTO v_recent
  FROM item_steal_attempts
  WHERE thief_id = p_thief_id AND created_at > NOW() - INTERVAL '24 hours';
  IF v_recent > 0 THEN
    RAISE EXCEPTION 'You can only attempt one item steal per 24 hours';
  END IF;

  -- Validate the steal item belongs to the thief
  SELECT ui.quantity, si.type, ui.user_id
  INTO v_steal_qty, v_steal_type, v_steal_owner
  FROM user_inventory ui
  JOIN shop_items si ON si.id = ui.item_id
  WHERE ui.id = p_steal_inventory_id;

  IF v_steal_owner IS NULL OR v_steal_owner <> p_thief_id THEN
    RAISE EXCEPTION 'Item steal not found in your inventory';
  END IF;
  IF v_steal_type <> 'item_steal' THEN
    RAISE EXCEPTION 'That item is not an item steal';
  END IF;

  -- Resolve the targeted inventory row
  SELECT ui.user_id, ui.quantity, ui.item_id, ui.expires_at, si.name, si.type, si.cost
  INTO v_target_id, v_target_qty, v_target_item_id, v_target_expires, v_item_name, v_item_type, v_worth
  FROM user_inventory ui
  JOIN shop_items si ON si.id = ui.item_id
  WHERE ui.id = p_target_inventory_id
  FOR UPDATE OF ui;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Target item not found';
  END IF;
  IF v_target_id = p_thief_id THEN
    RAISE EXCEPTION 'You cannot steal from yourself';
  END IF;

  v_worth := COALESCE(v_worth, 0);

  -- Lock both profiles
  SELECT gold, COALESCE(display_name, username)
  INTO v_thief_gold, v_thief_name
  FROM profiles WHERE id = p_thief_id FOR UPDATE;

  SELECT potion_immunity_expires, COALESCE(display_name, username)
  INTO v_target_potion, v_target_name
  FROM profiles WHERE id = v_target_id FOR UPDATE;

  -- Must be able to cover the worth if the steal fails
  IF v_thief_gold < v_worth THEN
    RAISE EXCEPTION 'You need at least % gold to risk this steal', v_worth;
  END IF;

  -- Potion immunity blocks the steal entirely (nothing consumed, no cooldown spent)
  IF v_target_potion IS NOT NULL AND v_target_potion > NOW() THEN
    RAISE EXCEPTION 'Target is protected by a potion';
  END IF;

  -- Roll 1..100
  v_roll := FLOOR(random() * 100)::INTEGER + 1;
  v_success := v_roll <= v_base_odds;

  -- Consume one item_steal
  IF v_steal_qty > 1 THEN
    UPDATE user_inventory SET quantity = quantity - 1 WHERE id = p_steal_inventory_id;
  ELSE
    DELETE FROM user_inventory WHERE id = p_steal_inventory_id;
  END IF;

  IF v_success THEN
    -- Remove one unit of the targeted item from the target
    IF v_target_qty > 1 THEN
      UPDATE user_inventory SET quantity = quantity - 1 WHERE id = p_target_inventory_id;
    ELSE
      DELETE FROM user_inventory WHERE id = p_target_inventory_id;
    END IF;

    -- Add it to the thief (merge with an existing stack or insert a new row)
    SELECT id, quantity INTO v_existing_inv, v_existing_qty
    FROM user_inventory
    WHERE user_id = p_thief_id AND item_id = v_target_item_id
    LIMIT 1;

    IF v_existing_inv IS NOT NULL THEN
      UPDATE user_inventory
      SET quantity = v_existing_qty + 1,
          -- For armour, keep the later of the two expiries so the steal never shortens it
          expires_at = CASE
            WHEN v_item_type = 'armour'
              THEN GREATEST(COALESCE(expires_at, v_target_expires), COALESCE(v_target_expires, expires_at))
            ELSE expires_at
          END
      WHERE id = v_existing_inv;
    ELSE
      INSERT INTO user_inventory (user_id, item_id, quantity, expires_at)
      VALUES (p_thief_id, v_target_item_id, 1, v_target_expires);
    END IF;

    INSERT INTO item_steal_attempts
      (thief_id, target_id, target_inventory_id, item_id, item_name, item_worth, success, gold_paid, roll)
    VALUES
      (p_thief_id, v_target_id, p_target_inventory_id, v_target_item_id, v_item_name, v_worth, true, 0, v_roll)
    RETURNING id INTO v_attempt_id;

    INSERT INTO item_steal_notifications (user_id, attempt_id, kind, message, gold_delta, item_name)
    VALUES (p_thief_id, v_attempt_id, 'steal_won',
            'You stole ' || v_item_name || ' from ' || v_target_name || '!', 0, v_item_name);
    INSERT INTO item_steal_notifications (user_id, attempt_id, kind, message, gold_delta, item_name)
    VALUES (v_target_id, v_attempt_id, 'item_stolen',
            v_thief_name || ' stole your ' || v_item_name || '!', 0, v_item_name);
  ELSE
    -- Failure: thief pays the target the item's worth
    IF v_worth > 0 THEN
      UPDATE profiles SET gold = GREATEST(0, gold - v_worth) WHERE id = p_thief_id;
      UPDATE profiles SET gold = gold + v_worth WHERE id = v_target_id;
    END IF;

    INSERT INTO item_steal_attempts
      (thief_id, target_id, target_inventory_id, item_id, item_name, item_worth, success, gold_paid, roll)
    VALUES
      (p_thief_id, v_target_id, p_target_inventory_id, v_target_item_id, v_item_name, v_worth, false, v_worth, v_roll)
    RETURNING id INTO v_attempt_id;

    INSERT INTO item_steal_notifications (user_id, attempt_id, kind, message, gold_delta, item_name)
    VALUES (p_thief_id, v_attempt_id, 'steal_lost',
            'Your steal on ' || v_target_name || ' failed. You paid ' || v_worth || ' gold.', -v_worth, v_item_name);
    INSERT INTO item_steal_notifications (user_id, attempt_id, kind, message, gold_delta, item_name)
    VALUES (v_target_id, v_attempt_id, 'thief_paid',
            v_thief_name || ' botched a steal on you and paid ' || v_worth || ' gold.', v_worth, v_item_name);
  END IF;

  RETURN jsonb_build_object(
    'success', v_success,
    'item_name', v_item_name,
    'worth', v_worth,
    'roll', v_roll,
    'target_name', v_target_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION attempt_item_steal(UUID, UUID, UUID) TO authenticated;

-- Verify install
SELECT 'item steal feature installed' AS status;
