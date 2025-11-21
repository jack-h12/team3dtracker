/**
 * Authentication Utilities
 * 
 * Helper functions for user authentication:
 * - signUp: Creates a new user account and profile
 * - signIn: Logs in an existing user
 * - signOut: Logs out the current user
 * - getCurrentUser: Gets the currently authenticated user
 * 
 * When a user signs up, a profile is automatically created in the profiles table.
 */

import { supabase } from './supabase'
import type { Profile } from './supabase'

export async function signUp(email: string, password: string, username: string) {
  // Create auth user (without metadata to avoid trigger issues)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`
    }
  })

  if (authError) {
    console.error('Auth signup error:', authError)
    // If it's a database error from Supabase Auth, it might be a trigger issue
    if (authError.message?.includes('Database error') || authError.message?.includes('saving new user')) {
      throw new Error('Database trigger error. Please run fix-signup-trigger.sql in Supabase SQL Editor to remove problematic triggers.')
    }
    throw authError
  }
  
  if (!authData.user) {
    throw new Error('Failed to create user - no user returned from signup')
  }

  // Wait a moment to ensure user is fully created
  await new Promise(resolve => setTimeout(resolve, 500))

  // Check if profile already exists (in case trigger created it)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (existingProfile) {
    // Profile exists, update username if it's different (trigger might have used email)
    if (existingProfile.username !== username) {
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', authData.user.id)
        .select()
        .single()
      
      return { user: authData.user, profile: updatedProfile || existingProfile, session: authData.session }
    }
    return { user: authData.user, profile: existingProfile, session: authData.session }
  }

  // Try using the database function first (bypasses RLS)
  const { error: functionError } = await supabase.rpc('create_user_profile', {
    user_id: authData.user.id,
    user_username: username
  })

  if (!functionError) {
    // Function succeeded, fetch the created profile
    const { data: profileData, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching created profile:', fetchError)
      throw new Error('Profile created but could not be retrieved')
    }

    return { user: authData.user, profile: profileData, session: authData.session }
  }

  // If function doesn't exist or failed, try direct insert
  console.warn('Database function not available, trying direct insert:', functionError)
  
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      username,
      avatar_level: 0,
      lifetime_exp: 0,
      gold: 100, // Starting gold
    })
    .select()
    .single()

  if (profileError) {
    console.error('Profile creation error:', profileError)
    // Provide more helpful error message
    if (profileError.code === 'PGRST116' || profileError.message?.includes('relation') || profileError.message?.includes('does not exist')) {
      throw new Error('Database table "profiles" not found. Please run the database setup SQL script in Supabase SQL Editor.')
    }
    if (profileError.code === '42501' || profileError.message?.includes('permission') || profileError.message?.includes('policy') || profileError.message?.includes('RLS')) {
      throw new Error('Permission denied by Row Level Security. Please run create-profile-function.sql in Supabase SQL Editor to create a helper function.')
    }
    if (profileError.code === '23503' || profileError.message?.includes('foreign key')) {
      throw new Error('Foreign key constraint failed. The user ID does not match auth.users table.')
    }
    throw new Error(`Database error saving profile: ${profileError.message || profileError.code || 'Unknown error'}`)
  }

  return { user: authData.user, profile: profileData, session: authData.session }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  // First check for existing session
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    return session.user
  }
  
  // Fallback to getUser() which validates the session
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}

