/**
 * Admin Utilities
 * 
 * Functions for admin management:
 * - isAdmin: Check if a user is an admin
 * - promoteToAdmin: Promote a user to admin (only admins can do this)
 * - demoteFromAdmin: Remove admin status from a user (only admins can do this)
 * - getAllUsers: Get all users (admin only)
 * - deleteUser: Delete a user account (admin only)
 * - deleteUserTasks: Delete all tasks for a user (admin only)
 * - updateUserGold: Set or modify user's gold (admin only)
 * - updateUserExp: Set or modify user's lifetime EXP (admin only)
 * - updateUserLevel: Set user's avatar level (admin only)
 * - resetUserData: Reset user to initial state (admin only)
 * - updateUserUsername: Change user's username (admin only)
 * - getUserTasks: Get all tasks for a user (admin only)
 * 
 * Admin features (Creative Mode):
 * - Can promote/demote other users
 * - Can view all users
 * - Can delete users
 * - Can modify user stats (gold, EXP, level)
 * - Can delete user tasks
 * - Can reset user data
 * - Can change usernames
 */

import { supabase } from './supabase'
import type { Profile, Task } from './supabase'

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return (data as { is_admin: boolean }).is_admin === true
}

export async function promoteToAdmin(adminUserId: string, targetUserId: string): Promise<void> {
  // Check if current user is admin
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can promote users')
  }

  // Promote target user
  const { error } = await ((supabase
    .from('profiles') as any)
    .update({ is_admin: true })
    .eq('id', targetUserId))

  if (error) throw error
}

export async function demoteFromAdmin(adminUserId: string, targetUserId: string): Promise<void> {
  // Check if current user is admin
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can demote users')
  }

  // Prevent demoting yourself
  if (adminUserId === targetUserId) {
    throw new Error('You cannot demote yourself')
  }

  // Demote target user
  const { error } = await ((supabase
    .from('profiles') as any)
    .update({ is_admin: false })
    .eq('id', targetUserId))

  if (error) throw error
}

export async function getAllUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Delete a user account (admin only)
 * WARNING: This permanently deletes the user and all their data
 */
export async function deleteUser(adminUserId: string, targetUserId: string): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can delete users')
  }

  // Prevent deleting yourself
  if (adminUserId === targetUserId) {
    throw new Error('You cannot delete yourself')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_delete_user', {
    target_user_id: targetUserId
  })

  if (error) {
    // Fallback to manual delete if function doesn't exist
    console.warn('Admin function not available, using manual delete:', error)
    
    // Delete user tasks first (cascade should handle this, but being explicit)
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', targetUserId)

    if (tasksError) throw tasksError

    // Delete user inventory
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .delete()
      .eq('user_id', targetUserId)

    if (inventoryError) throw inventoryError

    // Delete friend requests
    const { error: friendRequestsError } = await supabase
      .from('friend_requests')
      .delete()
      .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`)

    if (friendRequestsError) throw friendRequestsError

    // Delete profile (this will cascade to auth.users if foreign key is set up)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId)

    if (profileError) {
      throw new Error(`Failed to delete user: ${profileError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Delete all tasks for a user (admin only)
 */
export async function deleteUserTasks(adminUserId: string, targetUserId: string): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can delete user tasks')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_delete_user_tasks', {
    target_user_id: targetUserId
  })

  if (error) {
    // Fallback to direct delete if function doesn't exist
    console.warn('Admin function not available, using direct delete:', error)
    const { error: directError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', targetUserId)
    
    if (directError) {
      throw new Error(`Failed to delete tasks: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Update user's gold (admin only)
 */
export async function updateUserGold(adminUserId: string, targetUserId: string, gold: number): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can modify user gold')
  }

  if (gold < 0) {
    throw new Error('Gold cannot be negative')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_update_user_gold', {
    target_user_id: targetUserId,
    new_gold: gold
  })

  if (error) {
    // Fallback to direct update if function doesn't exist
    console.warn('Admin function not available, using direct update:', error)
    const { error: directError } = await ((supabase
      .from('profiles') as any)
      .update({ gold })
      .eq('id', targetUserId))
    
    if (directError) {
      throw new Error(`Failed to update gold: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Update user's lifetime EXP (admin only)
 */
export async function updateUserExp(adminUserId: string, targetUserId: string, exp: number): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can modify user EXP')
  }

  if (exp < 0) {
    throw new Error('EXP cannot be negative')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_update_user_exp', {
    target_user_id: targetUserId,
    new_exp: exp
  })

  if (error) {
    // Fallback to direct update if function doesn't exist
    console.warn('Admin function not available, using direct update:', error)
    const { error: directError } = await ((supabase
      .from('profiles') as any)
      .update({ lifetime_exp: exp })
      .eq('id', targetUserId))
    
    if (directError) {
      throw new Error(`Failed to update EXP: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Update user's avatar level (admin only)
 */
export async function updateUserLevel(adminUserId: string, targetUserId: string, level: number): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can modify user level')
  }

  if (level < 0 || level > 10) {
    throw new Error('Level must be between 0 and 10')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_update_user_level', {
    target_user_id: targetUserId,
    new_level: level
  })

  if (error) {
    // Fallback to direct update if function doesn't exist
    console.warn('Admin function not available, using direct update:', error)
    const { error: directError } = await ((supabase
      .from('profiles') as any)
      .update({ avatar_level: level })
      .eq('id', targetUserId))
    
    if (directError) {
      throw new Error(`Failed to update level: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Reset user data to initial state (admin only)
 * Resets: level to 0, tasks_completed_today to 0, but keeps gold and EXP
 */
export async function resetUserData(adminUserId: string, targetUserId: string): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can reset user data')
  }

  // Use database function to bypass RLS
  const { error } = await (supabase.rpc as any)('admin_reset_user_data', {
    target_user_id: targetUserId
  })

  if (error) {
    // Fallback to manual reset if function doesn't exist
    console.warn('Admin function not available, using manual reset:', error)
    
    // Delete all tasks
    await deleteUserTasks(adminUserId, targetUserId)

    // Reset level and tasks completed
    const { error: directError } = await ((supabase
      .from('profiles') as any)
      .update({
        avatar_level: 0,
        tasks_completed_today: 0
      })
      .eq('id', targetUserId))
    
    if (directError) {
      throw new Error(`Failed to reset user data: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Update user's username (admin only)
 */
export async function updateUserUsername(adminUserId: string, targetUserId: string, username: string): Promise<void> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can change usernames')
  }

  if (!username || username.trim().length === 0) {
    throw new Error('Username cannot be empty')
  }

  if (username.length > 50) {
    throw new Error('Username must be 50 characters or less')
  }

  // Use database function to bypass RLS (includes username validation)
  const { error } = await (supabase.rpc as any)('admin_update_username', {
    target_user_id: targetUserId,
    new_username: username.trim()
  })

  if (error) {
    // Fallback to direct update if function doesn't exist
    console.warn('Admin function not available, using direct update:', error)
    
    // Check if username is already taken
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', targetUserId)
      .single()

    if (existingUser) {
      throw new Error('Username is already taken')
    }

    const { error: directError } = await ((supabase
      .from('profiles') as any)
      .update({ username: username.trim() })
      .eq('id', targetUserId))
    
    if (directError) {
      throw new Error(`Failed to update username: ${directError.message}. Please run add-admin-creative-mode.sql in Supabase SQL Editor.`)
    }
  }
}

/**
 * Get all tasks for a user (admin only)
 */
export async function getUserTasks(adminUserId: string, targetUserId: string): Promise<Task[]> {
  const isUserAdmin = await isAdmin(adminUserId)
  if (!isUserAdmin) {
    throw new Error('Only admins can view user tasks')
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', targetUserId)
    .order('task_order', { ascending: true })

  if (error) throw error
  return data || []
}

