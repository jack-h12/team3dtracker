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
import { addDays } from './tasks'
import type { Profile, Task } from './supabase'

export type WeeklyProfile = Profile & { weekly_exp: number }

// Returns the YYYY-MM-DD date of the Sunday whose 5 PM EST reset marks the
// start of the current week's Monday task day. Weekly EXP is the difference
// between the user's current lifetime_exp and their lifetime_exp recorded in
// the daily leaderboard snapshot on that Sunday.
export function getWeekStartSnapshotDate(): string {
  const now = new Date()
  const easternHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    10
  )
  const todayEastern = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // After 5 PM EST the current task day is tomorrow — matches getCurrentTaskDate.
  const effectiveDate = easternHour >= 17 ? addDays(todayEastern, 1) : todayEastern

  const [y, m, d] = effectiveDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = dt.getUTCDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Days back to this week's Monday. Sunday (0) is the last day of the Mon-Sun
  // week, so Monday was 6 days ago in that case.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const mondayDate = addDays(effectiveDate, -daysToMonday)
  // The snapshot we want is the one taken at the reset BEFORE Monday's task day,
  // which is labeled with the previous Sunday's date.
  return addDays(mondayDate, -1)
}

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

export async function getWeeklyLeaderboard(signal?: AbortSignal): Promise<WeeklyProfile[]> {
  const weekStartDate = getWeekStartSnapshotDate()

  const profilesQuery = supabase
    .from('profiles')
    .select('*')
    .limit(100)
  if (signal) profilesQuery.abortSignal(signal)
  const { data: profilesData, error: profilesError } = await profilesQuery
  if (profilesError) throw profilesError

  const snapshotsQuery = supabase
    .from('daily_leaderboard_snapshots')
    .select('user_id, lifetime_exp')
    .eq('snapshot_date', weekStartDate)
  if (signal) snapshotsQuery.abortSignal(signal)
  const { data: snapshotsData, error: snapshotsError } = await snapshotsQuery
  if (snapshotsError) throw snapshotsError

  const baselineByUser = new Map<string, number>()
  for (const row of (snapshotsData || []) as { user_id: string; lifetime_exp: number }[]) {
    baselineByUser.set(row.user_id, row.lifetime_exp || 0)
  }

  const profiles = (profilesData || []) as Profile[]
  const enriched: WeeklyProfile[] = profiles.map((p) => {
    // No snapshot → user joined mid-week; treat baseline as 0 so all their
    // current lifetime_exp counts toward this week.
    const baseline = baselineByUser.get(p.id) ?? 0
    const weekly_exp = Math.max(0, p.lifetime_exp - baseline)
    return { ...p, weekly_exp }
  })

  enriched.sort((a, b) => {
    if (b.weekly_exp !== a.weekly_exp) return b.weekly_exp - a.weekly_exp
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return enriched
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

