/**
 * Core lifts — five permanent leaderboards (squat, bench, deadlift, OHP, pull-ups)
 * with absolute and pound-for-pound (DOTS) rankings.
 *
 * DOTS replaced Wilks as the IPF's official p4p scoring formula in 2020.
 * We use the male coefficients (this app is male-only by design).
 *
 * DB stores canonical units: weight values in kg, bodyweight snapshot in kg.
 * For pullup_amrap, value is reps and bodyweight is informational only.
 * For pullup_weighted_1rm, value is added weight (kg); the lifted total used
 * for DOTS is bodyweight + added weight.
 */

import { supabase } from './supabase'
import { computeAge, computeMaxHR, computeVO2Max } from './liftProfile'

export type Exercise = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'pullup' | 'dips' | 'row'
export type Variant = '1rm' | '5rm' | '10rm' | 'amrap_bw' | 'weighted_1rm'
export type CoreLiftUnit = 'weight' | 'reps'

export type CoreLift = {
  id: string
  exercise: Exercise
  variant: Variant
  display_name: string
  unit: CoreLiftUnit
  sort_order: number
}

export type CoreLiftSubmission = {
  id: string
  core_lift_id: string
  user_id: string
  value: number              // kg for weight lifts, reps for AMRAP
  bodyweight_kg: number
  video_url: string
  notes: string | null
  created_at: string
}

export type CoreLiftSubmissionWithUser = CoreLiftSubmission & {
  username: string
  display_name: string | null
  avatar_level: number
  dots: number | null         // null for AMRAP
}

// IPF DOTS male coefficients (official, valid 2020+).
const DOTS_MALE = {
  a: -307.75076,
  b: 24.0900756,
  c: -0.1918759221,
  d: 0.0007391293,
  e: -0.000001093,
}
const DOTS_BW_MIN_KG = 40
const DOTS_BW_MAX_KG = 210

// DOTS = lifted_kg * 500 / poly(BW_kg). Returns null for non-positive lifts.
export function computeDots(liftedKg: number, bodyweightKg: number): number | null {
  if (!(liftedKg > 0) || !(bodyweightKg > 0)) return null
  const bw = Math.min(Math.max(bodyweightKg, DOTS_BW_MIN_KG), DOTS_BW_MAX_KG)
  const { a, b, c, d, e } = DOTS_MALE
  const denom = a + b * bw + c * bw * bw + d * bw * bw * bw + e * bw * bw * bw * bw
  if (denom <= 0) return null
  return (liftedKg * 500) / denom
}

// For a submission, the "lifted weight" used in DOTS depends on the variant.
// Returns null when DOTS is not meaningful (bodyweight AMRAP).
export function dotsForSubmission(
  lift: Pick<CoreLift, 'variant' | 'unit'>,
  sub: Pick<CoreLiftSubmission, 'value' | 'bodyweight_kg'>,
): number | null {
  if (lift.unit === 'reps') return null
  const lifted =
    lift.variant === 'weighted_1rm'
      ? sub.bodyweight_kg + sub.value
      : sub.value
  return computeDots(lifted, sub.bodyweight_kg)
}

export async function listCoreLifts(): Promise<CoreLift[]> {
  const { data, error } = await supabase
    .from('core_lifts')
    .select('*')
    .order('exercise', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []) as CoreLift[]
}

export async function getCoreLiftSubmissions(coreLiftId: string): Promise<CoreLiftSubmissionWithUser[]> {
  const { data: lift, error: liftErr } = await supabase
    .from('core_lifts')
    .select('*')
    .eq('id', coreLiftId)
    .maybeSingle()
  if (liftErr) throw liftErr
  if (!lift) return []
  const liftRow = lift as CoreLift

  const { data, error } = await supabase
    .from('core_lift_submissions')
    .select('*')
    .eq('core_lift_id', coreLiftId)
    .order('value', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  const subs = (data || []) as CoreLiftSubmission[]
  if (subs.length === 0) return []

  const userIds = Array.from(new Set(subs.map((s) => s.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_level')
    .in('id', userIds)
  const map = new Map<string, { username: string; display_name: string | null; avatar_level: number }>()
  for (const p of (profiles || []) as { id: string; username: string; display_name: string | null; avatar_level: number }[]) {
    map.set(p.id, { username: p.username, display_name: p.display_name, avatar_level: p.avatar_level })
  }

  return subs.map((s) => {
    const u = map.get(s.user_id)
    return {
      ...s,
      username: u?.username || 'unknown',
      display_name: u?.display_name || null,
      avatar_level: u?.avatar_level || 0,
      dots: dotsForSubmission(liftRow, s),
    }
  })
}

export type CoreLiftSummary = {
  count: number
  topValue: number | null
  topUsername: string | null
  topDisplayName: string | null
}

// One row per core_lift_id with entry count and current absolute leader.
// "Current winner" = highest value (reps for AMRAP, kg for weight lifts),
// matching the default sort on the detail page.
export async function getCoreLiftSummaries(): Promise<Record<string, CoreLiftSummary>> {
  const { data, error } = await supabase
    .from('core_lift_submissions')
    .select('core_lift_id, user_id, value')
  if (error) throw error
  const rows = (data || []) as Array<{ core_lift_id: string; user_id: string; value: number }>

  const counts = new Map<string, number>()
  const topByLift = new Map<string, { user_id: string; value: number }>()
  for (const r of rows) {
    counts.set(r.core_lift_id, (counts.get(r.core_lift_id) || 0) + 1)
    const cur = topByLift.get(r.core_lift_id)
    if (!cur || r.value > cur.value) {
      topByLift.set(r.core_lift_id, { user_id: r.user_id, value: r.value })
    }
  }

  const userIds = Array.from(new Set(Array.from(topByLift.values()).map((t) => t.user_id)))
  const userMap = new Map<string, { username: string; display_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds)
    for (const p of (profiles || []) as Array<{ id: string; username: string; display_name: string | null }>) {
      userMap.set(p.id, { username: p.username, display_name: p.display_name })
    }
  }

  const out: Record<string, CoreLiftSummary> = {}
  const allLiftIds = new Set<string>()
  counts.forEach((_v, k) => allLiftIds.add(k))
  topByLift.forEach((_v, k) => allLiftIds.add(k))
  allLiftIds.forEach((id) => {
    const top = topByLift.get(id)
    const u = top ? userMap.get(top.user_id) : undefined
    out[id] = {
      count: counts.get(id) || 0,
      topValue: top ? top.value : null,
      topUsername: u?.username || null,
      topDisplayName: u?.display_name || null,
    }
  })
  return out
}

export type CompositeScoreRow = {
  user_id: string
  username: string
  display_name: string | null
  avatar_level: number
  age: number
  bodyweight_kg: number
  resting_hr: number
  squat_1rm_kg: number
  bench_1rm_kg: number
  deadlift_1rm_kg: number
  total_kg: number
  max_hr: number
  vo2_max: number
  score: number
}

// Composite "strength × endurance" score:
//   ((bench_1rm + squat_1rm + deadlift_1rm) * vo2_max) / bodyweight
// where vo2_max = (max_hr / resting_hr) * 15.3 and max_hr = 220 - age.
// Only users with all of: birth_date, resting_hr, and a 1RM in each of
// squat/bench/deadlift are ranked. Each user uses their best 1RM per lift.
export async function getCompositeScoreLeaderboard(): Promise<CompositeScoreRow[]> {
  const [{ data: profilesData, error: pErr }, { data: subsData, error: sErr }] = await Promise.all([
    supabase.from('lift_profiles').select('user_id, weight_kg, resting_hr, birth_date'),
    supabase
      .from('core_lift_submissions')
      .select('core_lift_id, user_id, value')
      .in('core_lift_id', ['squat_1rm', 'bench_1rm', 'deadlift_1rm']),
  ])
  if (pErr) throw pErr
  if (sErr) throw sErr

  const profiles = (profilesData || []) as Array<{
    user_id: string; weight_kg: number; resting_hr: number | null; birth_date: string | null
  }>
  const subs = (subsData || []) as Array<{ core_lift_id: string; user_id: string; value: number }>

  const bestByUser = new Map<string, { squat?: number; bench?: number; deadlift?: number }>()
  for (const s of subs) {
    const cur = bestByUser.get(s.user_id) || {}
    const key = s.core_lift_id === 'squat_1rm' ? 'squat'
      : s.core_lift_id === 'bench_1rm' ? 'bench'
      : 'deadlift'
    const prev = (cur as Record<string, number | undefined>)[key]
    if (prev === undefined || s.value > prev) {
      ;(cur as Record<string, number>)[key] = s.value
    }
    bestByUser.set(s.user_id, cur)
  }

  const rows: Omit<CompositeScoreRow, 'username' | 'display_name' | 'avatar_level'>[] = []
  for (const p of profiles) {
    if (!p.birth_date || !p.resting_hr || !(p.weight_kg > 0)) continue
    const age = computeAge(p.birth_date)
    if (age === null || age <= 0) continue
    const best = bestByUser.get(p.user_id)
    if (!best || best.squat === undefined || best.bench === undefined || best.deadlift === undefined) continue
    const total = best.squat + best.bench + best.deadlift
    const maxHR = computeMaxHR(age)
    const vo2 = computeVO2Max(maxHR, p.resting_hr)
    if (vo2 === null) continue
    const score = (total * vo2) / p.weight_kg
    rows.push({
      user_id: p.user_id,
      age,
      bodyweight_kg: p.weight_kg,
      resting_hr: p.resting_hr,
      squat_1rm_kg: best.squat,
      bench_1rm_kg: best.bench,
      deadlift_1rm_kg: best.deadlift,
      total_kg: total,
      max_hr: maxHR,
      vo2_max: vo2,
      score,
    })
  }

  if (rows.length === 0) return []
  const userIds = rows.map((r) => r.user_id)
  const { data: usersData } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_level')
    .in('id', userIds)
  const userMap = new Map<string, { username: string; display_name: string | null; avatar_level: number }>()
  for (const u of (usersData || []) as Array<{ id: string; username: string; display_name: string | null; avatar_level: number }>) {
    userMap.set(u.id, { username: u.username, display_name: u.display_name, avatar_level: u.avatar_level })
  }

  return rows
    .map((r) => {
      const u = userMap.get(r.user_id)
      return {
        ...r,
        username: u?.username || 'unknown',
        display_name: u?.display_name || null,
        avatar_level: u?.avatar_level || 0,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export type UserCoreLiftEntry = {
  core_lift_id: string
  exercise: Exercise
  variant: Variant
  display_name: string
  unit: CoreLiftUnit
  value: number
  bodyweight_kg: number
  video_url: string
  notes: string | null
  created_at: string
  rank: number | null         // absolute rank against everyone, null if not ranked
  totalEntries: number        // for that core_lift_id
  dots: number | null
}

// All of a user's core-lift submissions (best per lift) plus their absolute rank.
export async function getUserCoreLiftStats(userId: string): Promise<UserCoreLiftEntry[]> {
  const [{ data: liftsData, error: liftsErr }, { data: subsData, error: subsErr }] = await Promise.all([
    supabase.from('core_lifts').select('*'),
    supabase.from('core_lift_submissions').select('core_lift_id, user_id, value, bodyweight_kg, video_url, notes, created_at'),
  ])
  if (liftsErr) throw liftsErr
  if (subsErr) throw subsErr
  const lifts = (liftsData || []) as CoreLift[]
  const subs = (subsData || []) as Array<Pick<CoreLiftSubmission, 'core_lift_id' | 'user_id' | 'value' | 'bodyweight_kg' | 'video_url' | 'notes' | 'created_at'>>

  const liftById = new Map<string, CoreLift>()
  for (const l of lifts) liftById.set(l.id, l)

  // Group all submissions by core_lift_id, sort desc by value to compute ranks.
  const byLift = new Map<string, typeof subs>()
  for (const s of subs) {
    const arr = byLift.get(s.core_lift_id) || []
    arr.push(s)
    byLift.set(s.core_lift_id, arr)
  }

  const out: UserCoreLiftEntry[] = []
  byLift.forEach((arr, liftId) => {
    arr.sort((a, b) => b.value - a.value || (a.created_at < b.created_at ? -1 : 1))
    const userBestIdx = arr.findIndex((s) => s.user_id === userId)
    if (userBestIdx === -1) return
    const lift = liftById.get(liftId)
    if (!lift) return
    const userSub = arr[userBestIdx]
    out.push({
      core_lift_id: liftId,
      exercise: lift.exercise,
      variant: lift.variant,
      display_name: lift.display_name,
      unit: lift.unit,
      value: userSub.value,
      bodyweight_kg: userSub.bodyweight_kg,
      video_url: userSub.video_url,
      notes: userSub.notes,
      created_at: userSub.created_at,
      rank: userBestIdx + 1,
      totalEntries: arr.length,
      dots: dotsForSubmission(lift, userSub),
    })
  })

  // Sort output by EXERCISE_ORDER then sort_order.
  const orderIdx = new Map<Exercise, number>()
  EXERCISE_ORDER.forEach((e, i) => orderIdx.set(e, i))
  out.sort((a, b) => {
    const ai = orderIdx.get(a.exercise) ?? 999
    const bi = orderIdx.get(b.exercise) ?? 999
    if (ai !== bi) return ai - bi
    const liftA = liftById.get(a.core_lift_id)
    const liftB = liftById.get(b.core_lift_id)
    return (liftA?.sort_order || 0) - (liftB?.sort_order || 0)
  })
  return out
}

export async function submitCoreLiftEntry(input: {
  core_lift_id: string
  user_id: string
  value: number             // kg for weight lifts, reps for AMRAP
  bodyweight_kg: number
  video_url: string
  notes?: string | null
}): Promise<CoreLiftSubmission> {
  const payload = {
    core_lift_id: input.core_lift_id,
    user_id: input.user_id,
    value: input.value,
    bodyweight_kg: input.bodyweight_kg,
    video_url: input.video_url,
    notes: input.notes?.trim().slice(0, 300) || null,
  }
  const { data, error } = await ((supabase
    .from('core_lift_submissions') as any)
    .insert(payload)
    .select('*')
    .single())
  if (error) throw error
  return data as CoreLiftSubmission
}

export async function deleteCoreLiftSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('core_lift_submissions').delete().eq('id', id)
  if (error) throw error
}

export const EXERCISE_LABEL: Record<Exercise, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
  ohp: 'Military Press',
  pullup: 'Pull-Ups',
  dips: 'Dips',
  row: 'Bent Over Row',
}

export const EXERCISE_EMOJI: Record<Exercise, string> = {
  squat: '🦵',
  bench: '💪',
  deadlift: '🏋️ ❚█══█❚',
  ohp: '🪖 🏋️‍♂️',
  pullup: '🆙',
  dips: '🔻',
  row: '🚣',
}

export const EXERCISE_ORDER: Exercise[] = ['squat', 'bench', 'deadlift', 'ohp', 'pullup', 'dips', 'row']

export const EXERCISE_IMAGE: Record<Exercise, string> = {
  squat: '/gorilla_centurion_squat.png',
  bench: '/gorilla_centurion_bench.png',
  deadlift: '/gorilla_centurion_deadlift.png',
  ohp: '/gorilla_centurion_military_press.png',
  pullup: '/gorilla_centurion_pull_ups.png',
  dips: '/gorilla_centurion_dips.png',
  row: '/gorilla_centurion_bent_over_row.png',
}
