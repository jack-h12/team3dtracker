-- ============================================
-- FIX: Bankrob RLS infinite recursion (42P17)
-- Run this in your Supabase SQL Editor.
--
-- Root cause: the SELECT policies on bankrob_attempts and bankrob_invites each
-- contained an inline `EXISTS (SELECT ... FROM <the other table>)`. Reading
-- bankrob_attempts evaluated its policy, which queried bankrob_invites, which
-- evaluated ITS policy, which queried bankrob_attempts, ... → Postgres aborts
-- with "infinite recursion detected in policy for relation bankrob_attempts"
-- (42P17). This broke getActiveAttemptAsPlanner / getPendingInvites (HTTP 500).
--
-- Fix: move each cross-table check into a SECURITY DEFINER helper function.
-- A SECURITY DEFINER function runs as its owner and does NOT re-enter the
-- calling table's RLS, so the policies no longer recurse into each other.
-- ============================================

-- Is p_user_id invited (crew) on this attempt? Reads bankrob_invites as owner,
-- bypassing that table's RLS so the bankrob_attempts policy can't recurse.
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

-- Who is the planner of the attempt this invite belongs to? Reads
-- bankrob_attempts as owner, bypassing that table's RLS so the bankrob_invites
-- policy can't recurse.
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

-- ---- Re-create the policies using the helpers (no inline cross-table EXISTS) ----
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
