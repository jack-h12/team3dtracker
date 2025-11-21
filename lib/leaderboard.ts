/**
 * Leaderboard Utilities
 * 
 * Functions for fetching leaderboard data:
 * - getDailyLeaderboard: Gets all users sorted by daily avatar_level
 * - getLifetimeLeaderboard: Gets all users sorted by lifetime_exp
 * - getUserTasks: Gets tasks for a specific user (for profile view)
 * 
 * These functions are used by the Leaderboard components to display rankings.
 */

import { supabase } from './supabase'
import type { Profile, Task } from './supabase'

export async function getDailyLeaderboard(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('avatar_level', { ascending: false })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function getLifetimeLeaderboard(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('lifetime_exp', { ascending: false })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function getUserTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('task_order', { ascending: true })

  if (error) throw error
  return data || []
}

