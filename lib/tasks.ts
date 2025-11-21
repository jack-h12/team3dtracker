/**
 * Task Management Utilities
 * 
 * Functions for managing daily tasks:
 * - getTodayTasks: Fetches tasks for the current day
 * - addTask: Adds a new task (max 10 per day)
 * - updateTask: Updates task description or completion status
 * - completeTask: Marks a task as done and updates user's level/exp
 * - deleteTask: Removes a task
 * - shouldResetTasks: Checks if tasks should reset (5pm EST)
 * - resetDailyTasks: Resets all tasks for a user (called at 5pm EST)
 * 
 * Task reset logic: Tasks reset daily at 5pm EST. The app checks this on load and when tasks are accessed.
 */

import { supabase } from './supabase'
import type { Task } from './supabase'

// Get 5pm EST in UTC (EST is UTC-5, EDT is UTC-4)
function getResetTimeToday(): Date {
  const now = new Date()
  const estOffset = -5 // EST offset
  const resetHour = 17 // 5pm
  
  // Create date in EST
  const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  estDate.setHours(resetHour, 0, 0, 0)
  
  // Convert back to UTC
  const utcReset = new Date(estDate.getTime() - (estOffset * 60 * 60 * 1000))
  return utcReset
}

export function shouldResetTasks(lastResetDate: string | null): boolean {
  if (!lastResetDate) return false // Don't auto-reset if no last reset date
  
  const lastReset = new Date(lastResetDate)
  const now = new Date()
  const resetTime = getResetTimeToday()
  
  // Only reset if:
  // 1. It's actually a new day (not the same day)
  // 2. We've passed today's reset time (5pm EST)
  // 3. The last reset was before today's reset time
  const lastResetDay = new Date(lastReset).toDateString()
  const today = now.toDateString()
  const isNewDay = lastResetDay !== today
  
  // Additional check: make sure we're not resetting multiple times on the same day
  const lastResetTime = lastReset.getTime()
  const resetTimeMs = resetTime.getTime()
  const nowMs = now.getTime()
  
  // Only reset if it's a new day AND we're past the reset time AND last reset was before today's reset time
  return isNewDay && nowMs >= resetTimeMs && lastResetTime < resetTimeMs
}

export async function getTodayTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('task_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function addTask(userId: string, description: string, reward?: string | null): Promise<Task> {
  // Check current task count
  const currentTasks = await getTodayTasks(userId)
  if (currentTasks.length >= 10) {
    throw new Error('Maximum 10 tasks per day')
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      description,
      reward: reward && reward.trim() ? reward.trim() : null,
      is_done: false,
      task_order: currentTasks.length,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function completeTask(taskId: string, userId: string): Promise<void> {
  // Mark task as done
  await updateTask(taskId, { is_done: true })

  // Get current profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError

  // Calculate new daily level (0-10 based on completed tasks)
  // Re-fetch tasks to get updated state
  const tasks = await getTodayTasks(userId)
  const completedCount = tasks.filter(t => t.is_done).length
  const newDailyLevel = Math.min(completedCount, 10)

  // Update profile: daily level and lifetime exp
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      avatar_level: newDailyLevel,
      lifetime_exp: profile.lifetime_exp + 1,
    })
    .eq('id', userId)

  if (updateError) throw updateError

  // Check if user completed all tasks (10 tasks total, all done) and award elite status if eligible
  if (tasks.length === 10 && completedCount === 10) {
    // Dynamically import to avoid circular dependency
    const { checkAndAwardEliteStatus } = await import('./elite')
    await checkAndAwardEliteStatus(userId)
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw error
}

export async function resetDailyTasks(userId: string): Promise<void> {
  // Delete all tasks for user
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)

  if (error) throw error

  // Reset avatar_level to 0
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_level: 0 })
    .eq('id', userId)

  if (profileError) throw profileError
}

