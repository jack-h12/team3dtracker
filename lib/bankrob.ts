/**
 * Bankrob Utilities
 *
 * Client wrappers around the bankrob_* RPCs / tables.
 * All mutations go through SECURITY DEFINER Postgres functions
 * so RLS doesn't get in the way and gold transfers stay atomic.
 */

import { supabase } from './supabase'
import { isGuest, requireAccount } from './guest'

export type BankrobAttempt = {
  id: string
  planner_id: string
  target_id: string
  status: 'pending' | 'resolved' | 'cancelled'
  success: boolean | null
  gold_pool: number | null
  roll: number | null
  success_threshold: number | null
  expires_at: string
  resolved_at: string | null
  created_at: string
}

export type BankrobInvite = {
  id: string
  attempt_id: string
  invited_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  responded_at: string | null
  created_at: string
}

export type BankrobNotification = {
  id: string
  user_id: string
  attempt_id: string | null
  kind: 'invite_received' | 'heist_won' | 'heist_lost' | 'planner_won' | 'planner_lost' | 'target_robbed' | 'target_paid'
  message: string
  gold_delta: number
  is_read: boolean
  created_at: string
}

export async function planBankrob(
  plannerId: string,
  targetId: string,
  inventoryId: string,
  crewIds: string[],
  timerMinutes = 5,
): Promise<string> {
  if (isGuest(plannerId)) requireAccount('plan a bankrob')

  const { data, error } = await (supabase.rpc as any)('plan_bankrob', {
    p_planner_id: plannerId,
    p_target_id: targetId,
    p_inventory_id: inventoryId,
    p_crew_ids: crewIds,
    p_timer_minutes: timerMinutes,
  })
  if (error) throw error
  return data as string
}

export async function resolveMyExpiredBankrobs(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('resolve_my_expired_bankrobs')
  if (error) {
    console.error('resolve_my_expired_bankrobs failed:', error)
    return 0
  }
  return (data as number) ?? 0
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('respond_bankrob_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  })
  if (error) throw error
}

export async function getActiveAttemptAsPlanner(
  userId: string,
  signal?: AbortSignal,
): Promise<(BankrobAttempt & { invites: (BankrobInvite & { username: string; display_name: string | null })[] }) | null> {
  if (isGuest(userId)) return null

  const query = supabase
    .from('bankrob_attempts')
    .select('*')
    .eq('planner_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)

  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  const attempt = (data?.[0] as BankrobAttempt | undefined) ?? null
  if (!attempt) return null

  const { data: invites, error: invErr } = await supabase
    .from('bankrob_invites')
    .select('*, profile:profiles!bankrob_invites_invited_user_id_fkey(username, display_name)')
    .eq('attempt_id', attempt.id)
  if (invErr) throw invErr

  const enriched = (invites || []).map((row: any) => ({
    id: row.id,
    attempt_id: row.attempt_id,
    invited_user_id: row.invited_user_id,
    status: row.status,
    responded_at: row.responded_at,
    created_at: row.created_at,
    username: row.profile?.username ?? '',
    display_name: row.profile?.display_name ?? null,
  }))
  return { ...attempt, invites: enriched }
}

export async function getPendingInvites(
  userId: string,
  signal?: AbortSignal,
): Promise<
  (BankrobInvite & { attempt: BankrobAttempt; planner_username: string; planner_display_name: string | null; target_username: string; target_display_name: string | null })[]
> {
  if (isGuest(userId)) return []

  const query = supabase
    .from('bankrob_invites')
    .select(`
      *,
      attempt:bankrob_attempts!inner(
        *,
        planner:profiles!bankrob_attempts_planner_id_fkey(username, display_name),
        target:profiles!bankrob_attempts_target_id_fkey(username, display_name)
      )
    `)
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .eq('attempt.status', 'pending')
    .order('created_at', { ascending: false })

  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    attempt_id: row.attempt_id,
    invited_user_id: row.invited_user_id,
    status: row.status,
    responded_at: row.responded_at,
    created_at: row.created_at,
    attempt: row.attempt,
    planner_username: row.attempt?.planner?.username ?? '',
    planner_display_name: row.attempt?.planner?.display_name ?? null,
    target_username: row.attempt?.target?.username ?? '',
    target_display_name: row.attempt?.target?.display_name ?? null,
  }))
}

export async function getBankrobNotifications(
  userId: string,
  signal?: AbortSignal,
): Promise<BankrobNotification[]> {
  if (isGuest(userId)) return []
  const query = supabase
    .from('bankrob_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as BankrobNotification[]
}

export async function markBankrobNotificationRead(notificationId: string): Promise<void> {
  const { error } = await (supabase.from('bankrob_notifications') as any)
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function getBankrobUnreadCount(userId: string, signal?: AbortSignal): Promise<number> {
  if (isGuest(userId)) return 0
  // Exclude kinds that aren't surfaced in the Inbox (planner's own results, raw invites).
  const query = supabase
    .from('bankrob_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .not('kind', 'in', '(invite_received,planner_won,planner_lost)')
  if (signal) query.abortSignal(signal)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export async function markAllBankrobRead(userId: string): Promise<void> {
  const { error } = await (supabase.from('bankrob_notifications') as any)
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function clearBankrobNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('bankrob_notifications')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

export function getBankrobConfig(effect: any) {
  const e = typeof effect === 'string' ? safeParse(effect) : effect || {}
  return {
    baseOdds: Number(e.base_odds ?? 50),
    crewBonus: Number(e.crew_bonus ?? 10),
    maxOdds: Number(e.max_odds ?? 60),
    lootPct: Number(e.loot_pct ?? 0),
    maxCrew: Number(e.max_crew ?? 1),
    minLoot: Number(e.min_loot ?? 100),
  }
}

function safeParse(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}
