/**
 * Ten Testosterone Commandments
 *
 * Daily slider-based tracking (1–10) across ten lifestyle habits grouped
 * into three importance tiers (gold / silver / bronze). Scores are stored
 * per user / task-day / commandment in the `testosterone_scores` table.
 * See docs/sql/add-testosterone-commandments.sql for the schema.
 */

import { supabase } from './supabase'
import { addDays, getCurrentTaskDate } from './tasks'
import type { Profile } from './supabase'

export type Tier = 'gold' | 'silver' | 'bronze'

export type CommandmentKey =
  | 'steak'
  | 'sweets'
  | 'sleep'
  | 'stress'
  | 'sunlight'
  | 'stomach'
  | 'status'
  | 'connection'
  | 'steps'
  | 'strength'

export type Commandment = {
  key: CommandmentKey
  label: string
  description: string
  tier: Tier
}

export const COMMANDMENTS: Commandment[] = [
  {
    key: 'steak',
    label: 'Steak',
    description:
      'Eat nutrient-dense protein from high quality animal sources such as fatty red meat, eggs, fatty fish, oysters, milk, & liver/organ meats.',
    tier: 'gold',
  },
  {
    key: 'sweets',
    label: 'Sweets',
    description:
      'Eat nutrient-dense carbohydrate, plant, and healthy fat sources daily depending on your activity levels (honey, fruits, and vegetables/plants full of vitamins, minerals, antioxidants, and pre/probiotics etc.)',
    tier: 'gold',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    description: 'Sleep at least 8 to 10 hours a day.',
    tier: 'gold',
  },
  {
    key: 'stress',
    label: 'Stress',
    description:
      'Reduce extreme or chronic mental, physical, and inflammatory stress daily.',
    tier: 'silver',
  },
  {
    key: 'sunlight',
    label: 'Sunlight',
    description:
      'Get plenty of sunlight daily both to your eyes and skin.',
    tier: 'silver',
  },
  {
    key: 'stomach',
    label: 'Stomach',
    description:
      'Eat a 250–500 calorie deficit or surplus daily if over 20% or under 10% body fat.',
    tier: 'silver',
  },
  {
    key: 'status',
    label: 'Status',
    description: 'Compete for social status.',
    tier: 'bronze',
  },
  {
    key: 'connection',
    label: 'Connection',
    description: 'Build and maintain meaningful social connection.',
    tier: 'bronze',
  },
  {
    key: 'steps',
    label: 'Steps',
    description: 'Walk 8–10k+ steps daily.',
    tier: 'bronze',
  },
  {
    key: 'strength',
    label: 'Strength',
    description: 'Resistance training.',
    tier: 'bronze',
  },
]

export const TIER_META: Record<Tier, { label: string; color: string; border: string }> = {
  gold: { label: 'Gold', color: '#ffd700', border: '#ffd700' },
  silver: { label: 'Silver', color: '#c0c0c0', border: '#c0c0c0' },
  bronze: { label: 'Bronze', color: '#cd7f32', border: '#cd7f32' },
}

export type CommandmentScore = {
  commandment: CommandmentKey
  score: number
  score_date: string
}

export type ScoreMap = Partial<Record<CommandmentKey, number>>

// Simple average of whatever scores are present. Matches the "overall score"
// readout in the reference screenshot (unweighted mean of the ring).
export function averageScore(scores: ScoreMap): number {
  const values = COMMANDMENTS
    .map((c) => scores[c.key])
    .filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return sum / values.length
}

export async function getScoresForDate(
  userId: string,
  date: string,
  signal?: AbortSignal
): Promise<ScoreMap> {
  const query = supabase
    .from('testosterone_scores')
    .select('commandment, score')
    .eq('user_id', userId)
    .eq('score_date', date)
  if (signal) query.abortSignal(signal)

  const { data, error } = await query
  if (error) throw error

  const map: ScoreMap = {}
  for (const row of (data || []) as { commandment: CommandmentKey; score: number }[]) {
    map[row.commandment] = row.score
  }
  return map
}

export async function getScoresInRange(
  userId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<CommandmentScore[]> {
  const query = supabase
    .from('testosterone_scores')
    .select('commandment, score, score_date')
    .eq('user_id', userId)
    .gte('score_date', startDate)
    .lte('score_date', endDate)
  if (signal) query.abortSignal(signal)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as CommandmentScore[]
}

// Average each commandment across the supplied rows. Missing commandments
// remain undefined in the returned map so the UI can display them as gaps.
export function averagePerCommandment(rows: CommandmentScore[]): ScoreMap {
  const totals: Record<string, { sum: number; count: number }> = {}
  for (const row of rows) {
    const key = row.commandment
    if (!totals[key]) totals[key] = { sum: 0, count: 0 }
    totals[key].sum += row.score
    totals[key].count += 1
  }
  const out: ScoreMap = {}
  for (const c of COMMANDMENTS) {
    const t = totals[c.key]
    if (t && t.count > 0) out[c.key] = t.sum / t.count
  }
  return out
}

export async function upsertScore(
  userId: string,
  commandment: CommandmentKey,
  score: number,
  date?: string
): Promise<void> {
  const score_date = date || getCurrentTaskDate()
  const clamped = Math.max(1, Math.min(10, Math.round(score)))

  const { error } = await (supabase.from('testosterone_scores') as any).upsert(
    {
      user_id: userId,
      score_date,
      commandment,
      score: clamped,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,score_date,commandment' }
  )
  if (error) throw error
}

// Returns the past `days` dates (inclusive of today) ending with the current
// task date, oldest first.
export function getRecentDates(days: number): string[] {
  const today = getCurrentTaskDate()
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(addDays(today, -i))
  }
  return out
}

// Start date (Monday) of the week containing the current task date. Matches
// getWeekStartSnapshotDate's Mon–Sun week boundary (one day later since
// that helper returns the Sunday-before-Monday snapshot).
export function getCurrentWeekStart(): string {
  const today = getCurrentTaskDate()
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0 = Sunday, 1 = Monday
  const daysToMonday = dow === 0 ? 6 : dow - 1
  return addDays(today, -daysToMonday)
}

export type TestosteroneLeaderboardRow = {
  profile: Profile
  score: number
  completed_count: number
}

// Daily leaderboard: average of today's scores per user. Users with no
// entries for today are excluded.
export async function getDailyTestosteroneLeaderboard(
  signal?: AbortSignal
): Promise<TestosteroneLeaderboardRow[]> {
  const today = getCurrentTaskDate()

  const scoresQuery = supabase
    .from('testosterone_scores')
    .select('user_id, commandment, score')
    .eq('score_date', today)
  if (signal) scoresQuery.abortSignal(signal)
  const { data: scoreRows, error: scoreErr } = await scoresQuery
  if (scoreErr) throw scoreErr

  return buildLeaderboard(
    (scoreRows || []) as { user_id: string; commandment: CommandmentKey; score: number }[],
    1,
    signal
  )
}

// Weekly leaderboard: average of all scores from Monday of the current week
// through today.
export async function getWeeklyTestosteroneLeaderboard(
  signal?: AbortSignal
): Promise<TestosteroneLeaderboardRow[]> {
  const weekStart = getCurrentWeekStart()
  const today = getCurrentTaskDate()

  const scoresQuery = supabase
    .from('testosterone_scores')
    .select('user_id, commandment, score, score_date')
    .gte('score_date', weekStart)
    .lte('score_date', today)
  if (signal) scoresQuery.abortSignal(signal)
  const { data: scoreRows, error: scoreErr } = await scoresQuery
  if (scoreErr) throw scoreErr

  // Count days spanned for "completed_count" context.
  const daysSpan =
    Math.round(
      (Date.UTC(
        ...(today.split('-').map(Number) as [number, number, number])
      ) -
        Date.UTC(
          ...(weekStart.split('-').map(Number) as [number, number, number])
        )) /
        (24 * 60 * 60 * 1000)
    ) + 1

  return buildLeaderboard(
    (scoreRows || []) as { user_id: string; commandment: CommandmentKey; score: number }[],
    daysSpan,
    signal
  )
}

async function buildLeaderboard(
  rows: { user_id: string; commandment: CommandmentKey; score: number }[],
  _daysSpan: number,
  signal?: AbortSignal
): Promise<TestosteroneLeaderboardRow[]> {
  // Aggregate by user: mean of all their score rows in the window.
  const agg = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    const a = agg.get(r.user_id) || { sum: 0, count: 0 }
    a.sum += r.score
    a.count += 1
    agg.set(r.user_id, a)
  }

  const userIds = Array.from(agg.keys())
  if (userIds.length === 0) return []

  const profilesQuery = supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)
  if (signal) profilesQuery.abortSignal(signal)
  const { data: profiles, error: profilesErr } = await profilesQuery
  if (profilesErr) throw profilesErr

  const result: TestosteroneLeaderboardRow[] = ((profiles || []) as Profile[]).map((p) => {
    const a = agg.get(p.id)!
    return {
      profile: p,
      score: a.sum / a.count,
      completed_count: a.count,
    }
  })

  result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.completed_count !== a.completed_count) return b.completed_count - a.completed_count
    return new Date(a.profile.created_at).getTime() - new Date(b.profile.created_at).getTime()
  })

  return result
}
