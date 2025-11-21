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
import type { Task, Profile } from './supabase'

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

export async function completeTask(taskId: string, userId: string): Promise<void> {
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
    return // Task already completed, no reward
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
  // Re-fetch tasks to get updated state
  const tasks = await getTodayTasks(userId)
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
    exp_increase: 1,
    new_level: newDailyLevel,
    tasks_completed_today: newTasksCompletedToday
  })

  if (updateError) {
    // Fallback to direct update if function doesn't exist
    console.warn('Database function not available, using direct update:', updateError)
    const { error: directUpdateError } = await ((supabase
      .from('profiles') as any)
      .update({
        avatar_level: newDailyLevel,
        lifetime_exp: typedProfile.lifetime_exp + 1,
        gold: typedProfile.gold + goldReward,
        tasks_completed_today: newTasksCompletedToday,
      })
      .eq('id', userId))
    
    if (directUpdateError) throw directUpdateError
  }

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

