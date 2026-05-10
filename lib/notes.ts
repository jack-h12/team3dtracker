import { supabase } from './supabase'
import type { DailyNote } from './supabase'
import { isGuest, requireAccount } from './guest'

export async function getNoteForDate(userId: string, date: string): Promise<DailyNote | null> {
  if (isGuest(userId)) return null
  const { data, error } = await supabase
    .from('daily_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('note_date', date)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertNote(userId: string, date: string, content: string): Promise<void> {
  if (isGuest(userId)) requireAccount('save notes')
  const { error } = await supabase
    .from('daily_notes')
    .upsert(
      { user_id: userId, note_date: date, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,note_date' }
    )

  if (error) throw error
}

export async function getDatesWithNotes(userId: string): Promise<string[]> {
  if (isGuest(userId)) return []
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note_date')
    .eq('user_id', userId)
    .neq('content', '')

  if (error) throw error
  return (data || []).map((d: { note_date: string }) => d.note_date)
}
