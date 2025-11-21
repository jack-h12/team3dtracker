/**
 * Elite Status Utilities
 * 
 * Functions for managing elite status (first 3 to complete all tasks):
 * - checkAndAwardEliteStatus: Checks if user completed all tasks and awards elite status if in top 3
 * - isEliteUser: Checks if a user has elite status
 * - getEliteUsers: Gets all elite users
 * - canPurchaseRestrictedItem: Checks if user can purchase restricted items (weapons, name_change)
 */

import { supabase } from './supabase'

const MAX_ELITE_USERS = 3

export async function checkAndAwardEliteStatus(userId: string): Promise<boolean> {
  // Get user's tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError)
    return false
  }

  // Check if user has completed all tasks (10 tasks, all done)
  if (tasks.length === 10 && tasks.every(t => t.is_done)) {
    // Check if user already has elite status
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_completed_all_tasks_at')
      .eq('id', userId)
      .single()

    if (profile?.first_completed_all_tasks_at) {
      // Already elite
      return true
    }

    // Check how many elite users exist
    const { data: eliteUsers, error: eliteError } = await supabase
      .from('profiles')
      .select('id, first_completed_all_tasks_at')
      .not('first_completed_all_tasks_at', 'is', null)
      .order('first_completed_all_tasks_at', { ascending: true })
      .limit(MAX_ELITE_USERS)

    if (eliteError) {
      console.error('Error fetching elite users:', eliteError)
      return false
    }

    // If less than 3 elite users, award elite status
    if (eliteUsers && eliteUsers.length < MAX_ELITE_USERS) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ first_completed_all_tasks_at: new Date().toISOString() })
        .eq('id', userId)

      if (updateError) {
        console.error('Error awarding elite status:', updateError)
        return false
      }

      return true
    }
  }

  return false
}

export async function isEliteUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_completed_all_tasks_at')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return data.first_completed_all_tasks_at !== null
}

export async function getEliteUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, first_completed_all_tasks_at')
    .not('first_completed_all_tasks_at', 'is', null)
    .order('first_completed_all_tasks_at', { ascending: true })
    .limit(MAX_ELITE_USERS)

  if (error) throw error
  return data || []
}

export async function canPurchaseRestrictedItem(userId: string): Promise<boolean> {
  return await isEliteUser(userId)
}

