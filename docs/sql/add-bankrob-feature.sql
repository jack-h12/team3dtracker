-- ============================================
-- BANKROB FEATURE
-- Run this in your Supabase SQL Editor.
--
-- Adds:
--   * 'bankrob' shop item type + one shop row
--   * bankrob_attempts table
--   * bankrob_invites table
--   * bankrob_notifications table (results surfaced to planner/crew/target)
--   * plan_bankrob() RPC
--   * respond_bankrob_invite() RPC
--   * resolve_bankrob() helper
--   * resolve_expired_bankrobs() cron entry point
-- ============================================

-- ---- shop_items: add 'bankrob' to the allowed type set ----
-- The 'type' column has a CHECK constraint built from a varying list of strings.
-- We drop/recreate it to add the new value. If your project does not have this
-- CHECK constraint (older schemas), the DO block is a no-op.
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
  CHECK (type IN ('armour','weapon','potion','pet','name_change','name_restore','display_name_restore','bankrob'));

-- ---- Seed one bankrob shop item (idempotent) ----
INSERT INTO shop_items (name, type, cost, effect)
SELECT
  'Bankrob',
  'bankrob',
  100,
  '{"description":"Plan a heist on another player. 50% solo success, +10% with one crew member. Win: steal a random amount (min 100, max = target''s gold). Lose: pay a random amount (0 up to your own gold).","base_odds":50,"crew_bonus":10,"max_odds":60,"max_crew":1,"min_loot":100}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE type = 'bankrob');

-- Upgrade existing bankrob row to the new mechanics (idempotent on re-run)
UPDATE shop_items
SET cost = 100,
    effect = '{"description":"Plan a heist on another player. 50% solo success, +10% with one crew member. Win: steal a random amount (min 100, max = target''s gold). Lose: pay a random amount (0 up to your own gold).","base_odds":50,"crew_bonus":10,"max_odds":60,"max_crew":1,"min_loot":100}'::jsonb
WHERE type = 'bankrob';

-- ---- bankrob_attempts ----
CREATE TABLE IF NOT EXISTS bankrob_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  planner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  inventory_id UUID NOT NULL, -- the consumed bankrob inventory row (deleted on plan)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','cancelled')),
  success BOOLEAN,
  gold_pool INTEGER, -- nullable until resolved (computed at resolve time)
  roll INTEGER,      -- the 1..100 RNG roll, for transparency
  success_threshold INTEGER, -- threshold used at resolution
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bankrob_attempts_planner ON bankrob_attempts(planner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bankrob_attempts_target ON bankrob_attempts(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bankrob_attempts_pending ON bankrob_attempts(status, expires_at) WHERE status = 'pending';

-- ---- bankrob_invites ----
CREATE TABLE IF NOT EXISTS bankrob_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES bankrob_attempts(id) ON DELETE CASCADE NOT NULL,
  invited_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (attempt_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bankrob_invites_user ON bankrob_invites(invited_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bankrob_invites_attempt ON bankrob_invites(attempt_id);

-- ---- RLS policies (both tables must exist before policies that cross-reference) ----
ALTER TABLE bankrob_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankrob_invites ENABLE ROW LEVEL SECURITY;

-- Cross-table checks go through SECURITY DEFINER helpers so the two SELECT
-- policies don't reference each other's table inline and recurse forever
-- (42P17). A SECURITY DEFINER function runs as owner and bypasses the queried
-- table's RLS, breaking the cycle.
CREATE OR REPLACE FUNCTION bankrob_user_is_invited(p_attempt_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bankrob_invites bi
    WHERE bi.attempt_id = p_attempt_id AND bi.invited_user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION bankrob_attempt_planner(p_attempt_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT planner_id FROM bankrob_attempts WHERE id = p_attempt_id;
$$;

GRANT EXECUTE ON FUNCTION bankrob_user_is_invited(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bankrob_attempt_planner(UUID) TO authenticated;

DROP POLICY IF EXISTS "Read attempts you're involved in" ON bankrob_attempts;
CREATE POLICY "Read attempts you're involved in" ON bankrob_attempts FOR SELECT
  USING (
    auth.uid() = planner_id
    OR auth.uid() = target_id
    OR bankrob_user_is_invited(id, auth.uid())
  );

DROP POLICY IF EXISTS "Read invites you're involved in" ON bankrob_invites;
CREATE POLICY "Read invites you're involved in" ON bankrob_invites FOR SELECT
  USING (
    auth.uid() = invited_user_id
    OR bankrob_attempt_planner(attempt_id) = auth.uid()
  );

-- All writes happen via SECURITY DEFINER functions; no direct INSERT/UPDATE/DELETE policy.

-- ---- bankrob_notifications ----
-- A simple per-user inbox of heist events (invite-received, heist-result).
CREATE TABLE IF NOT EXISTS bankrob_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  attempt_id UUID REFERENCES bankrob_attempts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invite_received','heist_won','heist_lost','planner_won','planner_lost','target_robbed','target_paid')),
  message TEXT NOT NULL,
  gold_delta INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bankrob_notifications_user ON bankrob_notifications(user_id, is_read, created_at DESC);

-- Update CHECK constraint if it predates the planner_* kinds (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bankrob_notifications' AND constraint_name = 'bankrob_notifications_kind_check'
  ) THEN
    ALTER TABLE bankrob_notifications DROP CONSTRAINT bankrob_notifications_kind_check;
  END IF;
END$$;
ALTER TABLE bankrob_notifications
  ADD CONSTRAINT bankrob_notifications_kind_check
  CHECK (kind IN ('invite_received','heist_won','heist_lost','planner_won','planner_lost','target_robbed','target_paid'));

ALTER TABLE bankrob_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own bankrob notifications" ON bankrob_notifications;
CREATE POLICY "Read own bankrob notifications" ON bankrob_notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Update own bankrob notifications" ON bankrob_notifications;
CREATE POLICY "Update own bankrob notifications" ON bankrob_notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Delete own bankrob notifications" ON bankrob_notifications;
CREATE POLICY "Delete own bankrob notifications" ON bankrob_notifications FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RPC: plan_bankrob
-- Consumes one bankrob inventory item, creates a pending attempt, sends invites.
-- ============================================
CREATE OR REPLACE FUNCTION plan_bankrob(
  p_planner_id UUID,
  p_target_id UUID,
  p_inventory_id UUID,
  p_crew_ids UUID[],
  p_timer_minutes INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_inv_qty INTEGER;
  v_inv_item_type TEXT;
  v_inv_owner UUID;
  v_target_name TEXT;
  v_planner_name TEXT;
  v_existing_pending INTEGER;
  v_cooldown_recent INTEGER;
  v_crew UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_planner_id THEN
    RAISE EXCEPTION 'Not authorised to plan as another user';
  END IF;

  IF p_planner_id = p_target_id THEN
    RAISE EXCEPTION 'You cannot rob yourself';
  END IF;

  -- Planner has at most one active heist
  SELECT COUNT(*) INTO v_existing_pending
  FROM bankrob_attempts
  WHERE planner_id = p_planner_id AND status = 'pending';
  IF v_existing_pending > 0 THEN
    RAISE EXCEPTION 'You already have a pending heist';
  END IF;

  -- 24h planner cooldown
  SELECT COUNT(*) INTO v_cooldown_recent
  FROM bankrob_attempts
  WHERE planner_id = p_planner_id
    AND status = 'resolved'
    AND resolved_at > NOW() - INTERVAL '24 hours';
  IF v_cooldown_recent > 0 THEN
    RAISE EXCEPTION 'You can only attempt one bankrob per 24 hours';
  END IF;

  -- 24h target cooldown (don't re-rob same target)
  SELECT COUNT(*) INTO v_cooldown_recent
  FROM bankrob_attempts
  WHERE target_id = p_target_id
    AND status = 'resolved'
    AND resolved_at > NOW() - INTERVAL '24 hours';
  IF v_cooldown_recent > 0 THEN
    RAISE EXCEPTION 'This target was robbed in the last 24 hours';
  END IF;

  -- Validate the inventory item belongs to planner and is a bankrob
  SELECT ui.quantity, si.type, ui.user_id
  INTO v_inv_qty, v_inv_item_type, v_inv_owner
  FROM user_inventory ui
  JOIN shop_items si ON si.id = ui.item_id
  WHERE ui.id = p_inventory_id;

  IF v_inv_owner IS NULL OR v_inv_owner <> p_planner_id THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  IF v_inv_item_type <> 'bankrob' THEN
    RAISE EXCEPTION 'This item is not a bankrob';
  END IF;

  -- Consume one bankrob
  IF v_inv_qty > 1 THEN
    UPDATE user_inventory SET quantity = quantity - 1 WHERE id = p_inventory_id;
  ELSE
    DELETE FROM user_inventory WHERE id = p_inventory_id;
  END IF;

  -- Create the attempt
  INSERT INTO bankrob_attempts (planner_id, target_id, inventory_id, status, expires_at)
  VALUES (p_planner_id, p_target_id, p_inventory_id, 'pending', NOW() + (p_timer_minutes || ' minutes')::INTERVAL)
  RETURNING id INTO v_attempt_id;

  -- Insert invites (max 1 crew member, skip target/planner/duplicates)
  IF p_crew_ids IS NOT NULL THEN
    IF array_length(p_crew_ids, 1) > 1 THEN
      RAISE EXCEPTION 'You can only invite one crew member';
    END IF;
    FOREACH v_crew IN ARRAY p_crew_ids LOOP
      IF v_crew <> p_planner_id AND v_crew <> p_target_id THEN
        INSERT INTO bankrob_invites (attempt_id, invited_user_id)
        VALUES (v_attempt_id, v_crew)
        ON CONFLICT (attempt_id, invited_user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Resolve display names for notifications
  SELECT COALESCE(display_name, username) INTO v_planner_name FROM profiles WHERE id = p_planner_id;
  SELECT COALESCE(display_name, username) INTO v_target_name FROM profiles WHERE id = p_target_id;

  -- Notify each invited crew member
  INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message)
  SELECT bi.invited_user_id, v_attempt_id, 'invite_received',
         v_planner_name || ' invited you to rob ' || v_target_name
  FROM bankrob_invites bi WHERE bi.attempt_id = v_attempt_id;

  -- Solo heists (no invites) resolve immediately — no waiting on crew responses.
  IF NOT EXISTS (SELECT 1 FROM bankrob_invites WHERE attempt_id = v_attempt_id) THEN
    PERFORM resolve_bankrob(v_attempt_id);
  END IF;

  RETURN v_attempt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION plan_bankrob(UUID, UUID, UUID, UUID[], INTEGER) TO authenticated;

-- ============================================
-- RPC: respond_bankrob_invite
-- ============================================
CREATE OR REPLACE FUNCTION respond_bankrob_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited UUID;
  v_status TEXT;
  v_attempt_status TEXT;
BEGIN
  SELECT bi.invited_user_id, bi.status, ba.status
  INTO v_invited, v_status, v_attempt_status
  FROM bankrob_invites bi
  JOIN bankrob_attempts ba ON ba.id = bi.attempt_id
  WHERE bi.id = p_invite_id;

  IF v_invited IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invited <> auth.uid() THEN
    RAISE EXCEPTION 'Not your invite';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Invite already answered';
  END IF;
  IF v_attempt_status <> 'pending' THEN
    RAISE EXCEPTION 'Heist no longer accepting responses';
  END IF;

  UPDATE bankrob_invites
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = NOW()
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION respond_bankrob_invite(UUID, BOOLEAN) TO authenticated;

-- ============================================
-- Internal helper: resolve_bankrob (single attempt)
-- ============================================
CREATE OR REPLACE FUNCTION resolve_bankrob(p_attempt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_planner UUID;
  v_target UUID;
  v_status TEXT;
  v_target_gold INTEGER;
  v_planner_gold INTEGER;
  v_pool INTEGER;
  v_crew_count INTEGER;
  v_threshold INTEGER;
  v_roll INTEGER;
  v_success BOOLEAN;
  v_share INTEGER;
  v_remainder INTEGER;
  v_accepted UUID[];
  v_target_potion TIMESTAMP WITH TIME ZONE;
  v_target_name TEXT;
  v_planner_name TEXT;
  v_total_winners INTEGER;
  v_idx INTEGER;
  v_winner UUID;
BEGIN
  SELECT planner_id, target_id, status
  INTO v_planner, v_target, v_status
  FROM bankrob_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_planner IS NULL THEN
    RETURN;
  END IF;
  IF v_status <> 'pending' THEN
    RETURN;
  END IF;

  -- Gather accepted crew
  SELECT COALESCE(array_agg(invited_user_id), ARRAY[]::UUID[])
  INTO v_accepted
  FROM bankrob_invites
  WHERE attempt_id = p_attempt_id AND status = 'accepted';

  v_crew_count := COALESCE(array_length(v_accepted, 1), 0);

  -- Success threshold: 50 base, +10 if a crew member accepted (max 1 crew). Cap 60.
  v_threshold := LEAST(60, 50 + (LEAST(v_crew_count, 1) * 10));

  -- Target potion immunity check
  SELECT potion_immunity_expires, gold, COALESCE(display_name, username)
  INTO v_target_potion, v_target_gold, v_target_name
  FROM profiles WHERE id = v_target FOR UPDATE;

  SELECT gold, COALESCE(display_name, username)
  INTO v_planner_gold, v_planner_name
  FROM profiles WHERE id = v_planner FOR UPDATE;

  -- If target is immune via potion, treat as failed but no penalty (and notify)
  IF v_target_potion IS NOT NULL AND v_target_potion > NOW() THEN
    UPDATE bankrob_attempts
    SET status = 'resolved', success = false, gold_pool = 0,
        roll = NULL, success_threshold = v_threshold, resolved_at = NOW()
    WHERE id = p_attempt_id;

    INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
    VALUES (v_planner, p_attempt_id, 'planner_lost',
            v_target_name || ' was protected by a potion. Heist aborted, no gold lost.', 0);
    RETURN;
  END IF;

  -- Roll 1..100
  v_roll := FLOOR(random() * 100)::INTEGER + 1;
  v_success := v_roll <= v_threshold;

  -- Total winners = planner + accepted crew (on success)
  v_total_winners := 1 + v_crew_count;

  IF v_success THEN
    -- Loot: random between 100 and target's current gold (clamped).
    -- If target has < 100 gold, take whatever they have.
    IF v_target_gold <= 0 THEN
      v_pool := 0;
    ELSIF v_target_gold < 100 THEN
      v_pool := v_target_gold;
    ELSE
      v_pool := 100 + FLOOR(random() * (v_target_gold - 100 + 1))::INTEGER;
    END IF;

    -- Transfer pool out of target
    IF v_pool > 0 THEN
      UPDATE profiles SET gold = GREATEST(0, gold - v_pool) WHERE id = v_target;
    END IF;

    v_share := CASE WHEN v_pool > 0 AND v_total_winners > 0 THEN v_pool / v_total_winners ELSE 0 END;
    v_remainder := v_pool - (v_share * v_total_winners);

    -- Planner gets share + remainder
    UPDATE profiles SET gold = gold + v_share + v_remainder WHERE id = v_planner;

    -- Crew gets share each
    IF v_crew_count > 0 THEN
      FOR v_idx IN 1..v_crew_count LOOP
        v_winner := v_accepted[v_idx];
        UPDATE profiles SET gold = gold + v_share WHERE id = v_winner;
      END LOOP;
    END IF;

    -- Notifications
    INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
    VALUES (v_planner, p_attempt_id, 'planner_won',
            'Heist on ' || v_target_name || ' succeeded! You took ' || (v_share + v_remainder) || ' gold.',
            v_share + v_remainder);

    IF v_crew_count > 0 THEN
      FOR v_idx IN 1..v_crew_count LOOP
        v_winner := v_accepted[v_idx];
        INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
        VALUES (v_winner, p_attempt_id, 'heist_won',
                'Heist on ' || v_target_name || ' succeeded! Your cut: ' || v_share || ' gold.',
                v_share);
      END LOOP;
    END IF;

    INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
    VALUES (v_target, p_attempt_id, 'target_robbed',
            v_planner_name || ' robbed you for ' || v_pool || ' gold!',
            -v_pool);
  ELSE
    -- Failure: planner pays a random amount, 0 up to planner's current gold
    IF v_planner_gold <= 0 THEN
      v_pool := 0;
    ELSE
      v_pool := FLOOR(random() * (v_planner_gold + 1))::INTEGER;
    END IF;

    IF v_pool > 0 THEN
      UPDATE profiles SET gold = GREATEST(0, gold - v_pool) WHERE id = v_planner;
      UPDATE profiles SET gold = gold + v_pool WHERE id = v_target;
    END IF;

    INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
    VALUES (v_planner, p_attempt_id, 'planner_lost',
            'Heist on ' || v_target_name || ' failed. You paid ' || v_pool || ' gold.',
            -v_pool);

    INSERT INTO bankrob_notifications (user_id, attempt_id, kind, message, gold_delta)
    VALUES (v_target, p_attempt_id, 'target_paid',
            v_planner_name || ' botched a heist on you and paid ' || v_pool || ' gold.',
            v_pool);
  END IF;

  UPDATE bankrob_attempts
  SET status = 'resolved', success = v_success, gold_pool = v_pool,
      roll = v_roll, success_threshold = v_threshold, resolved_at = NOW()
  WHERE id = p_attempt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_bankrob(UUID) TO authenticated;

-- ============================================
-- RPC: resolve_expired_bankrobs (cron entry)
-- ============================================
CREATE OR REPLACE FUNCTION resolve_expired_bankrobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM bankrob_attempts
    WHERE status = 'pending' AND expires_at <= NOW()
  LOOP
    PERFORM resolve_bankrob(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_expired_bankrobs() TO service_role;

-- ============================================
-- RPC: resolve_my_expired_bankrobs
-- Lazy-resolve entry point for clients (free-tier alternative to cron).
-- Resolves any expired pending attempts where the caller is the planner,
-- the target, or an invited crew member. Safe to call on every Shop load.
-- ============================================
CREATE OR REPLACE FUNCTION resolve_my_expired_bankrobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_id IN
    SELECT ba.id
    FROM bankrob_attempts ba
    WHERE ba.status = 'pending'
      AND ba.expires_at <= NOW()
      AND (
        ba.planner_id = auth.uid()
        OR ba.target_id = auth.uid()
        OR EXISTS (SELECT 1 FROM bankrob_invites bi WHERE bi.attempt_id = ba.id AND bi.invited_user_id = auth.uid())
      )
  LOOP
    PERFORM resolve_bankrob(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_my_expired_bankrobs() TO authenticated;

-- Verify install
SELECT 'bankrob feature installed' AS status;
