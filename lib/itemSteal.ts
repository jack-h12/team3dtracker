/**
 * Item Steal Utilities
 *
 * Client wrappers around the item_steal_* RPCs / tables.
 * All mutations go through SECURITY DEFINER Postgres functions so RLS doesn't
 * get in the way and the item/gold transfer stays atomic.
 */

import { supabase } from './supabase'
import { isGuest, requireAccount } from './guest'

export type ItemStealNotification = {
  id: string
  user_id: string
  attempt_id: string | null
  kind: 'steal_won' | 'steal_lost' | 'item_stolen' | 'thief_paid'
  message: string
  gold_delta: number
  item_name: string | null
  is_read: boolean
  created_at: string
}

export type StealTargetItem = {
  inventory_id: string
  item_id: string
  name: string
  type: string
  cost: number
  quantity: number
}

export type ItemStealResult = {
  success: boolean
  item_name: string
  worth: number
  roll: number
  target_name: string
}

export type ItemStealCooldown = {
  onCooldown: boolean
  nextAvailable: string | null
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000

/**
 * Lists the items in a target's inventory that can be stolen.
 * Goes through a SECURITY DEFINER RPC since RLS hides other users' inventories.
 */
export async function listStealTargetInventory(targetId: string): Promise<StealTargetItem[]> {
  const { data, error } = await (supabase.rpc as any)('list_steal_target_inventory', {
    p_target_id: targetId,
  })
  if (error) throw error
  return (data || []) as StealTargetItem[]
}

export async function attemptItemSteal(
  thiefId: string,
  stealInventoryId: string,
  targetInventoryId: string,
): Promise<ItemStealResult> {
  if (isGuest(thiefId)) requireAccount('use item steal')
  const { data, error } = await (supabase.rpc as any)('attempt_item_steal', {
    p_thief_id: thiefId,
    p_steal_inventory_id: stealInventoryId,
    p_target_inventory_id: targetInventoryId,
  })
  if (error) throw error
  return data as ItemStealResult
}

/**
 * Returns whether the user is within the 24h steal cooldown, and when the next
 * attempt becomes available.
 */
export async function getItemStealCooldown(userId: string, signal?: AbortSignal): Promise<ItemStealCooldown> {
  if (isGuest(userId)) return { onCooldown: false, nextAvailable: null }
  const query = supabase
    .from('item_steal_attempts')
    .select('created_at')
    .eq('thief_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  const last = (data?.[0] as { created_at: string } | undefined)?.created_at
  if (!last) return { onCooldown: false, nextAvailable: null }
  const next = new Date(new Date(last).getTime() + COOLDOWN_MS)
  if (next.getTime() <= Date.now()) return { onCooldown: false, nextAvailable: null }
  return { onCooldown: true, nextAvailable: next.toISOString() }
}

export async function getItemStealNotifications(userId: string, signal?: AbortSignal): Promise<ItemStealNotification[]> {
  if (isGuest(userId)) return []
  const query = supabase
    .from('item_steal_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ItemStealNotification[]
}

export async function markItemStealNotificationRead(notificationId: string): Promise<void> {
  const { error } = await (supabase.from('item_steal_notifications') as any)
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function getItemStealUnreadCount(userId: string, signal?: AbortSignal): Promise<number> {
  if (isGuest(userId)) return 0
  // The thief sees their own result via the panel/modal — only surface the
  // target-facing notifications in the global unread count.
  const query = supabase
    .from('item_steal_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .not('kind', 'in', '(steal_won,steal_lost)')
  if (signal) query.abortSignal(signal)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export async function markAllItemStealRead(userId: string): Promise<void> {
  const { error } = await (supabase.from('item_steal_notifications') as any)
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function clearItemStealNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('item_steal_notifications')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}
