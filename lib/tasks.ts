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
  const nowMs = now.getTime()
  const lastResetMs = lastReset.getTime()

  // Find the most recent 5pm EST boundary that has already passed.
  // This handles the case where the user missed multiple reset windows
  // (e.g., didn't open the app for days). We need to check against the
  // LATEST passed 5pm, not just today's 5pm.
  const resetTimeToday = getResetTimeToday()
  const resetTimeTodayMs = resetTimeToday.getTime()

  // Determine the most recent reset boundary that has already passed
  let mostRecentResetMs: number
  if (nowMs >= resetTimeTodayMs) {
    // We're past today's 5pm — today's 5pm is the most recent boundary
    mostRecentResetMs = resetTimeTodayMs
  } else {
    // We're before today's 5pm — yesterday's 5pm is the most recent boundary
    mostRecentResetMs = resetTimeTodayMs - 24 * 60 * 60 * 1000
  }

  // Reset if the last reset was before the most recent 5pm boundary
  return lastResetMs < mostRecentResetMs
}

// Returns the current "task day" in Eastern time as YYYY-MM-DD.
// After 5pm Eastern the task day is tomorrow — this matches the
// 5pm EST reset boundary enforced by the cron.
export function getCurrentTaskDate(): string {
  const now = new Date()
  const easternHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    10
  )
  const todayEastern = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (easternHour >= 17) {
    return addDays(todayEastern, 1)
  }
  return todayEastern
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export async function getTasksForDate(userId: string, date: string, signal?: AbortSignal): Promise<Task[]> {
  const query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', date)
    .order('task_order', { ascending: true })

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function getTodayTasks(userId: string, signal?: AbortSignal): Promise<Task[]> {
  return getTasksForDate(userId, getCurrentTaskDate(), signal)
}

export async function addTask(
  userId: string,
  description: string,
  reward?: string | null,
  taskDate?: string
): Promise<Task> {
  const date = taskDate || getCurrentTaskDate()
  const currentTasks = await getTasksForDate(userId, date)
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
      task_date: date,
    })
    .select()
    .single())

  if (error) throw error
  return data
}

// Copies all tasks from (date - 1) into `date` as fresh, uncompleted tasks.
// Skips tasks that would overflow the 10-per-day cap. Returns inserted tasks.
export async function copyTasksFromPreviousDay(userId: string, date: string): Promise<Task[]> {
  const prevDate = addDays(date, -1)
  const [existing, source] = await Promise.all([
    getTasksForDate(userId, date),
    getTasksForDate(userId, prevDate),
  ])

  if (source.length === 0) {
    throw new Error('No tasks found for the previous day')
  }

  const slotsAvailable = 10 - existing.length
  if (slotsAvailable <= 0) {
    throw new Error('This day is already full (10 tasks)')
  }

  const toInsert = source.slice(0, slotsAvailable).map((t, i) => ({
    user_id: userId,
    description: t.description,
    reward: t.reward,
    is_done: false,
    task_order: existing.length + i,
    task_date: date,
  }))

  const { data, error } = await ((supabase
    .from('tasks') as any)
    .insert(toInsert)
    .select())

  if (error) throw error
  return (data || []) as Task[]
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

  // Check if user completed all tasks (10 tasks total, all done)
  if (tasks.length === 10 && completedCount === 10) {
    // Record the timestamp when they completed all 10 tasks (for leaderboard ranking)
    if (!updatedProfile.completed_all_tasks_at) {
      await ((supabase
        .from('profiles') as any)
        .update({ completed_all_tasks_at: new Date().toISOString() })
        .eq('id', userId))
    }

    // Re-fetch profile after updating completed_all_tasks_at
    const { data: refreshedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (refreshedProfile) updatedProfile = refreshedProfile as Profile
  }

  return updatedProfile
}

export async function uncompleteTask(taskId: string, userId: string, currentTasks?: Task[]): Promise<Profile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const typedProfile = profile as Profile

  // Mark task as not done
  await updateTask(taskId, { is_done: false })

  // Recalculate daily level
  let tasks: Task[]
  if (currentTasks) {
    tasks = currentTasks.map(t => t.id === taskId ? { ...t, is_done: false } : t)
  } else {
    tasks = await getTodayTasks(userId)
  }
  const completedCount = tasks.filter(t => t.is_done).length
  const newDailyLevel = Math.min(completedCount, 10)

  // Clear completion timestamp since they no longer have all 10 done
  if (typedProfile.completed_all_tasks_at) {
    await ((supabase
      .from('profiles') as any)
      .update({ completed_all_tasks_at: null })
      .eq('id', userId))
  }

  // Reverse rewards: subtract 10 gold and 5 EXP
  const newGold = Math.max(0, typedProfile.gold - 10)
  const newExp = Math.max(0, typedProfile.lifetime_exp - 5)
  const newTasksCompletedToday = Math.max(0, (typedProfile.tasks_completed_today || 0) - 1)

  const { error: updateError } = await (supabase.rpc as any)('update_user_gold_and_exp', {
    user_id_param: userId,
    gold_increase: -10,
    exp_increase: -5,
    new_level: newDailyLevel,
    tasks_completed_today: newTasksCompletedToday
  })

  let updatedProfile: Profile

  if (updateError) {
    console.warn('Database function not available, using direct update:', updateError)
    const { data: updatedData, error: directUpdateError } = await ((supabase
      .from('profiles') as any)
      .update({
        avatar_level: newDailyLevel,
        lifetime_exp: newExp,
        gold: newGold,
        tasks_completed_today: newTasksCompletedToday,
      })
      .eq('id', userId)
      .select()
      .single())

    if (directUpdateError) throw directUpdateError
    updatedProfile = updatedData as Profile
  } else {
    const { data: updatedData, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError) throw fetchError
    updatedProfile = updatedData as Profile
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
  const nowMs = now.getTime()
  const lastResetMs = lastReset.getTime()

  const resetTimeToday = getResetTimeToday()
  const resetTimeTodayMs = resetTimeToday.getTime()

  let mostRecentResetMs: number
  if (nowMs >= resetTimeTodayMs) {
    mostRecentResetMs = resetTimeTodayMs
  } else {
    mostRecentResetMs = resetTimeTodayMs - 24 * 60 * 60 * 1000
  }

  return lastResetMs < mostRecentResetMs
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

  // Reset avatar_level to 0, tasks_completed_today to 0, and clear completion timestamp
  const { error: profileError } = await ((supabase
    .from('profiles') as any)
    .update({
      avatar_level: 0,
      tasks_completed_today: 0,
      completed_all_tasks_at: null
    })
    .eq('id', userId))

  if (profileError) throw profileError
}

