/**
 * Admin Utilities
 * 
 * Functions for admin management:
 * - isAdmin: Check if a user is an admin
 * - promoteToAdmin: Promote a user to admin (only admins can do this)
 * - demoteFromAdmin: Remove admin status from a user (only admins can do this)
 * - getAllUsers: Get all users (admin only)
 * 
 * Admin features:
 * - Can promote/demote other users
 * - Can view all users
 * - Can manage shop items (future)
 */

import { supabase } from './supabase'
import type { Profile } from './supabase'

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

