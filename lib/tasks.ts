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
 * - shouldResetAvatar: Checks if avatar should reset (5pm EST)
 * - resetAvatar: Resets avatar level to 0 (called at 5pm EST)
 * 
 * Task reset logic: Tasks reset daily at 5pm EST. The app checks this on load and when tasks are accessed.
 * Avatar reset logic: Avatar resets to level 0 daily at 5pm EST, independently of task reset.
 */

import { supabase } from './supabase'
import type { Task, Profile } from './supabase'

// Get 5pm Eastern Time (EST/EDT) in UTC
// Automatically handles daylight saving time (EST is UTC-5, EDT is UTC-4)
function getResetTimeToday(): Date {
  const now = new Date()
  
  // Get current date in Eastern timezone (format: YYYY-MM-DD)
  const easternDateStr = now.toLocaleString('en-CA', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  
  // Create a date string for 5pm today in Eastern time
  const easternTimeString = `${easternDateStr}T17:00:00`
  
  // Calculate the timezone offset by comparing current time in both timezones
  // This automatically handles DST
  const nowUtc = now.getTime()
  const nowEasternStr = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  // Parse Eastern time string to create a date (treating as local)
  const [datePart, timePart] = nowEasternStr.split(', ')
  const [month, day, year] = datePart.split('/')
  const [hour, minute, second] = timePart.split(':')
  const nowEasternAsLocal = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  
  // Calculate offset: difference between UTC and Eastern representations
  const offsetMs = nowUtc - nowEasternAsLocal.getTime()
  
  // Create 5pm Eastern as a local date
  const fivePmEastern = new Date(easternTimeString)
  
  // Apply the offset to get UTC time
  return new Date(fivePmEastern.getTime() + offsetMs)
}

export function shouldResetTasks(lastResetDate: string | null): boolean {
  if (!lastResetDate) return false // Don't auto-reset if no last reset date
  
  const lastReset = new Date(lastResetDate)
  const now = new Date()
  const resetTime = getResetTimeToday()
  
  // Reset if:
  // 1. We've passed today's reset time (5pm EST)
  // 2. The last reset was before today's reset time
  // This ensures we reset once per day at 5pm, even if checked multiple times
  const lastResetTime = lastReset.getTime()
  const resetTimeMs = resetTime.getTime()
  const nowMs = now.getTime()
  
  // Reset if we're past the reset time AND last reset was before today's reset time
  return nowMs >= resetTimeMs && lastResetTime < resetTimeMs
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

  const { data, error } = await ((supabase
    .from('tasks') as any)
    .insert({
      user_id: userId,
      description,
      reward: reward && reward.trim() ? reward.trim() : null,
      is_done: false,
      task_order: currentTasks.length,
    })
    .select()
    .single())

  if (error) throw error
  return data
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await ((supabase
    .from('tasks') as any)
    .update(updates)
    .eq('id', taskId)
    .select()
    .single())

  if (error) throw error
  return data as Task
}

export async function completeTask(taskId: string, userId: string, currentTasks?: Task[]): Promise<Profile> {
  // Get current profile to check daily completion counter
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError

  // Get the task to check if it's already completed
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (taskError) throw taskError

  // Type assertions
  const typedProfile = profile as Profile
  const typedTask = task as Task

  // If task is already completed, don't award gold/exp again
  if (typedTask.is_done) {
    return typedProfile // Task already completed, no reward
  }

  // Check if user has already completed 10 tasks today (daily cap)
  const tasksCompletedToday = typedProfile.tasks_completed_today || 0
  if (tasksCompletedToday >= 10) {
    // Still mark the task as done, but don't award rewards
    await updateTask(taskId, { is_done: true })
    throw new Error('Daily task completion limit reached (10 tasks per day). Gold and EXP are capped.')
  }

  // Mark task as done
  await updateTask(taskId, { is_done: true })

  // Calculate new daily level (0-10 based on completed tasks)
  // Use provided tasks array if available, otherwise fetch
  let tasks: Task[]
  if (currentTasks) {
    // Update the task in the provided array
    tasks = currentTasks.map(t => t.id === taskId ? { ...t, is_done: true } : t)
  } else {
    // Fallback: fetch tasks if not provided
    tasks = await getTodayTasks(userId)
  }
  const completedCount = tasks.filter(t => t.is_done).length
  const newDailyLevel = Math.min(completedCount, 10)

  // Award gold for completing task (10 gold per task)
  const goldReward = 10
  
  // Increment the daily completion counter
  const newTasksCompletedToday = tasksCompletedToday + 1
  
  // Update profile: daily level, lifetime exp, gold, and completion counter using database function (bypasses RLS)
  const { error: updateError } = await (supabase.rpc as any)('update_user_gold_and_exp', {
    user_id_param: userId,
    gold_increase: goldReward,
    exp_increase: 5, // Award 5 EXP per task completed
    new_level: newDailyLevel,
    tasks_completed_today: newTasksCompletedToday
  })

  let updatedProfile: Profile

  if (updateError) {
    // Fallback to direct update if function doesn't exist
    console.warn('Database function not available, using direct update:', updateError)
    const { data: updatedData, error: directUpdateError } = await ((supabase
      .from('profiles') as any)
      .update({
        avatar_level: newDailyLevel,
        lifetime_exp: typedProfile.lifetime_exp + 5, // Award 5 EXP per task completed
        gold: typedProfile.gold + goldReward,
        tasks_completed_today: newTasksCompletedToday,
      })
      .eq('id', userId)
      .select()
      .single())
    
    if (directUpdateError) throw directUpdateError
    updatedProfile = updatedData as Profile
  } else {
    // Fetch updated profile after RPC call
    const { data: updatedData, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (fetchError) throw fetchError
    updatedProfile = updatedData as Profile
  }

  // Check if user completed all tasks (10 tasks total, all done) and award elite status if eligible
  if (tasks.length === 10 && completedCount === 10) {
    // Dynamically import to avoid circular dependency
    const { checkAndAwardEliteStatus } = await import('./elite')
    await checkAndAwardEliteStatus(userId)
    // Re-fetch profile in case elite status was updated
    const { data: eliteProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (eliteProfile) updatedProfile = eliteProfile as Profile
  }

  return updatedProfile
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw error
}

export async function updateTaskOrder(userId: string, taskOrders: { taskId: string; order: number }[]): Promise<void> {
  // Update all task orders in a transaction-like manner
  const updates = taskOrders.map(({ taskId, order }) =>
    (supabase
      .from('tasks') as any)
      .update({ task_order: order })
      .eq('id', taskId)
      .eq('user_id', userId)
  )

  const results = await Promise.all(updates)
  
  // Check for any errors
  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }
}

export function shouldResetAvatar(lastAvatarResetDate: string | null): boolean {
  if (!lastAvatarResetDate) return false // Don't auto-reset if no last reset date
  
  const lastReset = new Date(lastAvatarResetDate)
  const now = new Date()
  const resetTime = getResetTimeToday()
  
  // Reset if:
  // 1. We've passed today's reset time (5pm EST)
  // 2. The last reset was before today's reset time
  // This ensures we reset once per day at 5pm, even if checked multiple times
  const lastResetTime = lastReset.getTime()
  const resetTimeMs = resetTime.getTime()
  const nowMs = now.getTime()
  
  // Reset if we're past the reset time AND last reset was before today's reset time
  return nowMs >= resetTimeMs && lastResetTime < resetTimeMs
}

export async function resetAvatar(userId: string): Promise<void> {
  // Reset avatar_level to 0
  const { error: profileError } = await ((supabase
    .from('profiles') as any)
    .update({ 
      avatar_level: 0
    })
    .eq('id', userId))

  if (profileError) throw profileError
}

export async function resetDailyTasks(userId: string): Promise<void> {
  // Delete all tasks for user
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)

  if (error) throw error

  // Reset avatar_level to 0 and tasks_completed_today to 0
  const { error: profileError } = await ((supabase
    .from('profiles') as any)
    .update({ 
      avatar_level: 0,
      tasks_completed_today: 0
    })
    .eq('id', userId))

  if (profileError) throw profileError
}

