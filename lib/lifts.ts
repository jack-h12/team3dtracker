/**
 * Lift Leaderboards
 *
 * User-created weekly lift competitions. One creation per user per 7 days.
 * Submissions include a value (e.g. weight) and a video proof.
 * Top submitter at end-of-week gets 250 XP + 500 gold (handled DB-side).
 */

import { supabase } from './supabase'

export type LiftLeaderboard = {
  id: string
  creator_id: string
  title: string
  description: string | null
  unit: string
  starts_at: string
  ends_at: string
  status: 'active' | 'completed'
  winner_id: string | null
  reward_distributed: boolean
  created_at: string
}

export type LiftSubmission = {
  id: string
  leaderboard_id: string
  user_id: string
  value: number
  reps: number | null
  video_url: string
  notes: string | null
  created_at: string
}

export type LiftLeaderboardWithCreator = LiftLeaderboard & {
  creator_username: string
  creator_display_name: string | null
  submission_count: number
  winner_username?: string | null
  winner_display_name?: string | null
}

export type LiftSubmissionWithUser = LiftSubmission & {
  username: string
  display_name: string | null
  avatar_level: number
}

const VIDEO_BUCKET = 'lift-videos'
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB

export async function listLeaderboards(): Promise<LiftLeaderboardWithCreator[]> {
  const { data, error } = await supabase
    .from('lift_leaderboards')
    .select('*')
    .order('status', { ascending: true }) // 'active' before 'completed'
    .order('ends_at', { ascending: false })
    .limit(100)

  if (error) throw error
  const lbs = (data || []) as LiftLeaderboard[]
  if (lbs.length === 0) return []

  const userIds = Array.from(new Set([
    ...lbs.map((l) => l.creator_id),
    ...lbs.map((l) => l.winner_id).filter((x): x is string => !!x),
  ]))

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds)

  const profileMap = new Map<string, { username: string; display_name: string | null }>()
  for (const p of (profiles || []) as { id: string; username: string; display_name: string | null }[]) {
    profileMap.set(p.id, { username: p.username, display_name: p.display_name })
  }

  // Fetch submission counts per leaderboard
  const { data: subs } = await supabase
    .from('lift_submissions')
    .select('leaderboard_id')
    .in('leaderboard_id', lbs.map((l) => l.id))
  const counts = new Map<string, number>()
  for (const s of (subs || []) as { leaderboard_id: string }[]) {
    counts.set(s.leaderboard_id, (counts.get(s.leaderboard_id) || 0) + 1)
  }

  return lbs.map((l) => {
    const creator = profileMap.get(l.creator_id)
    const winner = l.winner_id ? profileMap.get(l.winner_id) : undefined
    return {
      ...l,
      creator_username: creator?.username || 'unknown',
      creator_display_name: creator?.display_name || null,
      winner_username: winner?.username || null,
      winner_display_name: winner?.display_name || null,
      submission_count: counts.get(l.id) || 0,
    }
  })
}

export async function getLeaderboard(id: string): Promise<LiftLeaderboardWithCreator | null> {
  const { data, error } = await supabase
    .from('lift_leaderboards')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const lb = data as LiftLeaderboard
  const ids = [lb.creator_id, lb.winner_id].filter((x): x is string => !!x)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', ids)

  const profileMap = new Map<string, { username: string; display_name: string | null }>()
  for (const p of (profiles || []) as { id: string; username: string; display_name: string | null }[]) {
    profileMap.set(p.id, { username: p.username, display_name: p.display_name })
  }
  const creator = profileMap.get(lb.creator_id)
  const winner = lb.winner_id ? profileMap.get(lb.winner_id) : undefined

  return {
    ...lb,
    creator_username: creator?.username || 'unknown',
    creator_display_name: creator?.display_name || null,
    winner_username: winner?.username || null,
    winner_display_name: winner?.display_name || null,
    submission_count: 0,
  }
}

export async function getSubmissions(leaderboardId: string): Promise<LiftSubmissionWithUser[]> {
  const { data, error } = await supabase
    .from('lift_submissions')
    .select('*')
    .eq('leaderboard_id', leaderboardId)
    .order('value', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  const subs = (data || []) as LiftSubmission[]
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
    }
  })
}

// Returns true if the user has created a leaderboard within the last 7 days
export async function hasCreatedLeaderboardRecently(userId: string): Promise<{ blocked: boolean; nextAllowedAt: string | null }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('lift_leaderboards')
    .select('created_at')
    .eq('creator_id', userId)
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return { blocked: false, nextAllowedAt: null }
  const last = (data[0] as { created_at: string }).created_at
  const nextAllowed = new Date(new Date(last).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return { blocked: true, nextAllowedAt: nextAllowed }
}

export async function createLeaderboard(input: {
  creator_id: string
  title: string
  description?: string
  unit: string
}): Promise<LiftLeaderboard> {
  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data, error } = await ((supabase
    .from('lift_leaderboards') as any)
    .insert({
      creator_id: input.creator_id,
      title: input.title.trim().slice(0, 80),
      description: input.description?.trim().slice(0, 500) || null,
      unit: input.unit,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select('*')
    .single())

  if (error) throw error
  return data as LiftLeaderboard
}

export async function uploadProofVideo(userId: string, file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video too large. Max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`)
  }
  if (!file.type.startsWith('video/')) {
    throw new Error('File must be a video.')
  }

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'mp4'}`

  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function submitEntry(input: {
  leaderboard_id: string
  user_id: string
  value: number
  reps?: number | null
  video_url: string
  notes?: string | null
}): Promise<LiftSubmission> {
  const payload = {
    leaderboard_id: input.leaderboard_id,
    user_id: input.user_id,
    value: input.value,
    reps: input.reps ?? null,
    video_url: input.video_url,
    notes: input.notes?.trim().slice(0, 300) || null,
  }
  const { data, error } = await ((supabase
    .from('lift_submissions') as any)
    .upsert(payload, { onConflict: 'leaderboard_id,user_id' })
    .select('*')
    .single())

  if (error) throw error
  return data as LiftSubmission
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('lift_submissions')
    .delete()
    .eq('id', submissionId)

  if (error) throw error
}

export async function deleteLeaderboard(leaderboardId: string): Promise<void> {
  const { error } = await supabase
    .from('lift_leaderboards')
    .delete()
    .eq('id', leaderboardId)

  if (error) throw error
}

// Best-effort: triggers DB finalization. Safe to call from any client.
export async function finalizeEnded(): Promise<void> {
  try {
    await (supabase.rpc as any)('finalize_ended_lift_leaderboards')
  } catch (err) {
    console.warn('finalize_ended_lift_leaderboards rpc failed (non-fatal):', err)
  }
}

export function formatTimeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
