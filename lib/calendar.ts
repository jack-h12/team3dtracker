/**
 * Calendar / History Utilities
 *
 * Functions for fetching daily snapshot data:
 * - getAvailableDates: Gets all dates that have snapshot data
 * - getTaskSnapshot: Gets a user's tasks for a specific date
 * - getLeaderboardSnapshot: Gets the final leaderboard for a specific date
 */

import { supabase } from './supabase'
import type { DailyTaskSnapshot, DailyLeaderboardSnapshot } from './supabase'

export async function getAvailableDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_task_snapshots')
    .select('snapshot_date')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })

  if (error) throw error

  // Deduplicate dates
  const seen: Record<string, boolean> = {}
  const uniqueDates: string[] = []
  for (const d of (data || [])) {
    if (!seen[d.snapshot_date]) {
      seen[d.snapshot_date] = true
      uniqueDates.push(d.snapshot_date)
    }
  }
  return uniqueDates
}

export async function getTaskSnapshot(userId: string, date: string): Promise<DailyTaskSnapshot[]> {
  const { data, error } = await supabase
    .from('daily_task_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('snapshot_date', date)
    .order('task_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getLeaderboardSnapshot(date: string): Promise<DailyLeaderboardSnapshot[]> {
  const { data, error } = await supabase
    .from('daily_leaderboard_snapshots')
    .select('*')
    .eq('snapshot_date', date)
    .order('rank', { ascending: true })

  if (error) throw error
  return data || []
}
