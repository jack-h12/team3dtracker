/**
 * Lift profile — one row per user with body stats used for relative-strength
 * scoring. Canonical units in DB are cm + kg; UI converts based on unit_pref.
 */

import { supabase } from './supabase'
import { isGuest, requireAccount } from './guest'

export type UnitPref = 'imperial' | 'metric'

export type LiftProfile = {
  user_id: string
  height_cm: number
  weight_kg: number
  resting_hr: number | null
  body_fat_pct: number | null
  birth_date: string | null      // ISO date 'YYYY-MM-DD'
  unit_pref: UnitPref
  updated_at: string
}

export function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const dob = new Date(birthDate)
  if (isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age >= 0 ? age : null
}

// Tanaka-style: simple 220 - age estimate (matches user's spec).
export function computeMaxHR(age: number): number {
  return 220 - age
}

// Uth-Sørensen-Overgaard-Pedersen: VO2 max ≈ (MHR / RHR) × 15.3.
export function computeVO2Max(maxHR: number, restingHR: number): number | null {
  if (!(restingHR > 0)) return null
  return (maxHR / restingHR) * 15.3
}

export const LBS_PER_KG = 2.2046226218
export const CM_PER_INCH = 2.54

export function kgToLbs(kg: number): number { return kg * LBS_PER_KG }
export function lbsToKg(lbs: number): number { return lbs / LBS_PER_KG }
export function cmToInches(cm: number): number { return cm / CM_PER_INCH }
export function inchesToCm(inches: number): number { return inches * CM_PER_INCH }

// FFMI = LBM_kg / height_m^2 + 6.1 * (1.8 - height_m). Requires body_fat_pct.
export function computeFFMI(p: Pick<LiftProfile, 'height_cm' | 'weight_kg' | 'body_fat_pct'>): number | null {
  if (p.body_fat_pct === null || p.body_fat_pct === undefined) return null
  const heightM = p.height_cm / 100
  if (heightM <= 0) return null
  const lbmKg = p.weight_kg * (1 - p.body_fat_pct / 100)
  return lbmKg / (heightM * heightM) + 6.1 * (1.8 - heightM)
}

export type LifterListing = {
  user_id: string
  height_cm: number
  weight_kg: number
  resting_hr: number | null
  body_fat_pct: number | null
  birth_date: string | null
  unit_pref: UnitPref
  updated_at: string
  username: string
  display_name: string | null
  avatar_level: number
}

// Every user with a lift profile, joined with their public profile fields,
// for the Lifters sidebar.
export async function listLifters(): Promise<LifterListing[]> {
  const { data, error } = await supabase
    .from('lift_profiles')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const profiles = (data || []) as LiftProfile[]
  if (profiles.length === 0) return []

  const userIds = profiles.map((p) => p.user_id)
  const { data: users } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_level')
    .in('id', userIds)
  const map = new Map<string, { username: string; display_name: string | null; avatar_level: number }>()
  for (const u of (users || []) as Array<{ id: string; username: string; display_name: string | null; avatar_level: number }>) {
    map.set(u.id, { username: u.username, display_name: u.display_name, avatar_level: u.avatar_level })
  }

  return profiles.map((p) => {
    const u = map.get(p.user_id)
    return {
      ...p,
      username: u?.username || 'unknown',
      display_name: u?.display_name || null,
      avatar_level: u?.avatar_level || 0,
    }
  })
}

export async function getProfile(userId: string): Promise<LiftProfile | null> {
  if (isGuest(userId)) return null
  const { data, error } = await supabase
    .from('lift_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as LiftProfile) || null
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from('lift_profiles')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

export async function upsertProfile(input: {
  user_id: string
  height_cm: number
  weight_kg: number
  resting_hr?: number | null
  body_fat_pct?: number | null
  birth_date?: string | null
  unit_pref: UnitPref
}): Promise<LiftProfile> {
  if (isGuest(input.user_id)) requireAccount('save a lifting profile')
  const payload = {
    user_id: input.user_id,
    height_cm: input.height_cm,
    weight_kg: input.weight_kg,
    resting_hr: input.resting_hr ?? null,
    body_fat_pct: input.body_fat_pct ?? null,
    birth_date: input.birth_date ?? null,
    unit_pref: input.unit_pref,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await ((supabase
    .from('lift_profiles') as any)
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single())
  if (error) throw error
  return data as LiftProfile
}

// Format a height in cm into either ft'in" (imperial) or "cm" (metric).
export function formatHeight(cm: number, pref: UnitPref): string {
  if (pref === 'metric') return `${Math.round(cm)} cm`
  const totalIn = cmToInches(cm)
  const ft = Math.floor(totalIn / 12)
  const inch = Math.round(totalIn - ft * 12)
  return `${ft}'${inch}"`
}

export function formatWeight(kg: number, pref: UnitPref, digits = 1): string {
  if (pref === 'metric') return `${kg.toFixed(digits)} kg`
  return `${kgToLbs(kg).toFixed(digits)} lbs`
}
