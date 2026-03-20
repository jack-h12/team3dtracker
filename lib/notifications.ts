import { supabase } from './supabase'

export type AttackNotification = {
  id: string
  target_user_id: string
  attacker_user_id: string
  attacker_username: string
  weapon_name: string
  damage_dealt: number
  is_read: boolean
  created_at: string
}

export async function getNotifications(userId: string, signal?: AbortSignal): Promise<AttackNotification[]> {
  const query = supabase
    .from('attack_notifications')
    .select('*')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as AttackNotification[]
}

export async function getUnreadCount(userId: string, signal?: AbortSignal): Promise<number> {
  const query = supabase
    .from('attack_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('target_user_id', userId)
    .eq('is_read', false)

  if (signal) {
    query.abortSignal(signal)
  }

  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await (supabase
    .from('attack_notifications') as any)
    .update({ is_read: true })
    .eq('target_user_id', userId)
    .eq('is_read', false)

  if (error) throw error
}

export async function markOneRead(notificationId: string): Promise<void> {
  const { error } = await (supabase
    .from('attack_notifications') as any)
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function clearAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('attack_notifications')
    .delete()
    .eq('target_user_id', userId)

  if (error) throw error
}

export async function createAttackNotification(
  targetUserId: string,
  attackerUserId: string,
  attackerUsername: string,
  weaponName: string,
  damageDealt: number
): Promise<void> {
  const { error } = await (supabase
    .from('attack_notifications') as any)
    .insert({
      target_user_id: targetUserId,
      attacker_user_id: attackerUserId,
      attacker_username: attackerUsername,
      weapon_name: weaponName,
      damage_dealt: damageDealt,
    })

  if (error) {
    console.error('Failed to create attack notification:', error)
  }
}
