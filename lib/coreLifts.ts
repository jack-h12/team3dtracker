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

export type Exercise = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'pullup'
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
}

export const EXERCISE_EMOJI: Record<Exercise, string> = {
  squat: '🦵',
  bench: '💪',
  deadlift: '🏋️ ❚█══█❚',
  ohp: '🪖 🏋️‍♂️',
  pullup: '🆙',
}

export const EXERCISE_ORDER: Exercise[] = ['squat', 'bench', 'deadlift', 'ohp', 'pullup']
