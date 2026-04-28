/**
 * Calendar / History Utilities
 *
 * Functions for fetching daily snapshot data:
 * - getAvailableDates: Gets all dates that have snapshot data
 * - getTaskSnapshot: Gets a user's tasks for a specific date
 * - getLeaderboardSnapshot: Gets the final leaderboard for a specific date
 */

import { supabase } from './supabase'
import { addDays } from './tasks'
import type { DailyTaskSnapshot, DailyLeaderboardSnapshot, DailyNote } from './supabase'

export type WeeklyLeaderboardEntry = {
  user_id: string
  username: string
  display_name: string | null
  avatar_level: number
  weekly_exp: number
  rank: number
}

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

export async function getNoteSnapshot(userId: string, date: string): Promise<DailyNote | null> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('note_date', date)
    .maybeSingle()

  if (error) throw error
  return data
}

// Computes the weekly leaderboard for the week ending on the given Sunday
// (i.e. Monday → Sunday) by diffing lifetime_exp between that Sunday's
// leaderboard snapshot and the prior Sunday's snapshot.
export async function getWeeklyLeaderboardForEndSunday(endSunday: string): Promise<WeeklyLeaderboardEntry[]> {
  const startSunday = addDays(endSunday, -7)

  const { data, error } = await supabase
    .from('daily_leaderboard_snapshots')
    .select('snapshot_date, user_id, username, display_name, avatar_level, lifetime_exp')
    .in('snapshot_date', [endSunday, startSunday])

  if (error) throw error

  const endRows: DailyLeaderboardSnapshot[] = []
  const baselineMap = new Map<string, number>()
  for (const r of (data || []) as DailyLeaderboardSnapshot[]) {
    if (r.snapshot_date === endSunday) endRows.push(r)
    else if (r.snapshot_date === startSunday) baselineMap.set(r.user_id, r.lifetime_exp || 0)
  }

  const enriched = endRows.map((r) => {
    const baseline = baselineMap.get(r.user_id) ?? 0
    const weekly_exp = Math.max(0, (r.lifetime_exp || 0) - baseline)
    return {
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_level: r.avatar_level,
      weekly_exp,
    }
  })

  enriched.sort((a, b) => b.weekly_exp - a.weekly_exp)

  return enriched.map((e, i) => ({ ...e, rank: i + 1 }))
}

// Returns YYYY-MM-DD strings for all Sundays that have a leaderboard snapshot.
export async function getSundaySnapshotDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_leaderboard_snapshots')
    .select('snapshot_date')

  if (error) throw error

  const seen = new Set<string>()
  for (const r of (data || []) as { snapshot_date: string }[]) {
    if (isSunday(r.snapshot_date)) seen.add(r.snapshot_date)
  }
  return Array.from(seen)
}

export function isSunday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0
}

export async function getDatesWithNotes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note_date')
    .eq('user_id', userId)
    .neq('content', '')

  if (error) throw error
  return (data || []).map((d: { note_date: string }) => d.note_date)
}
