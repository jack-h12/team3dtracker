/**
 * Leaderboard Utilities
 * 
 * Functions for fetching leaderboard data:
 * - getDailyLeaderboard: Gets all users sorted by daily avatar_level
 * - getLifetimeLeaderboard: Gets all users sorted by lifetime_exp
 * - getUserTasks: Gets tasks for a specific user (for profile view)
 * 
 * These functions are used by the Leaderboard components to display rankings.
 * 
 * Sorting: When users have the same level/exp, they are sorted by who reached it first
 * (earliest created_at timestamp ranks higher).
 */

import { supabase } from './supabase'
import type { Profile, Task } from './supabase'

export async function getDailyLeaderboard(signal?: AbortSignal): Promise<Profile[]> {
  const query = supabase
    .from('profiles')
    .select('*')
    .order('avatar_level', { ascending: false })
    .limit(100)

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Sort by completion order: users who completed all 10 tasks are ranked
  // by who finished first. Users who haven't completed all 10 are ranked below by level.
  const profiles: Profile[] = data || []
  const sorted = profiles.sort((a, b) => {
    const aCompleted = a.completed_all_tasks_at != null
    const bCompleted = b.completed_all_tasks_at != null

    // Both completed all tasks: rank by who finished first
    if (aCompleted && bCompleted) {
      return new Date(a.completed_all_tasks_at!).getTime() - new Date(b.completed_all_tasks_at!).getTime()
    }
    // Only one completed: they rank higher
    if (aCompleted && !bCompleted) return -1
    if (!aCompleted && bCompleted) return 1
    // Neither completed: sort by level descending, then by created_at
    if (b.avatar_level !== a.avatar_level) {
      return b.avatar_level - a.avatar_level
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  
  return sorted
}

export async function getLifetimeLeaderboard(signal?: AbortSignal): Promise<Profile[]> {
  const query = supabase
    .from('profiles')
    .select('*')
    .order('lifetime_exp', { ascending: false })
    .limit(100)

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Sort by exp (desc), then by created_at (asc) - earlier users rank higher when exp is equal
  const profiles: Profile[] = data || []
  const sorted = profiles.sort((a, b) => {
    if (b.lifetime_exp !== a.lifetime_exp) {
      return b.lifetime_exp - a.lifetime_exp // Higher exp first
    }
    // Same exp: earlier created_at (who got there first) ranks higher
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  
  return sorted
}

export async function getUserTasks(userId: string, signal?: AbortSignal): Promise<Task[]> {
  const query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('task_order', { ascending: true })

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

