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

export async function getDailyLeaderboard(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('avatar_level', { ascending: false })
    .limit(100)

  if (error) throw error
  
  // Sort by level (desc), then by created_at (asc) - earlier users rank higher when level is equal
  const profiles: Profile[] = data || []
  const sorted = profiles.sort((a, b) => {
    if (b.avatar_level !== a.avatar_level) {
      return b.avatar_level - a.avatar_level // Higher level first
    }
    // Same level: earlier created_at (who got there first) ranks higher
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  
  return sorted
}

export async function getLifetimeLeaderboard(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('lifetime_exp', { ascending: false })
    .limit(100)

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

export async function getUserTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('task_order', { ascending: true })

  if (error) throw error
  return data || []
}

