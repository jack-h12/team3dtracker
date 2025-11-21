/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for connecting to your Supabase backend.
 * It uses the NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from environment variables.
 * 
 * The client is used throughout the app to:
 * - Authenticate users (signup/login)
 * - Read/write to profiles, tasks, friend_requests, shop_items, and user_inventory tables
 * - Listen to real-time updates
 */

import { createClient } from '@supabase/supabase-js'

// Get env vars - these are available at runtime in the browser
const supabaseUrl = typeof window !== 'undefined' 
  ? (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  : process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const supabaseAnonKey = typeof window !== 'undefined'
  ? (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Create a singleton client instance
let supabaseClient: ReturnType<typeof createClient> | null = null

export const supabase = (() => {
  if (supabaseClient) {
    return supabaseClient
  }

  // During build time, if env vars are missing, use placeholder values
  // This prevents build errors, but the app won't work until env vars are set
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseAnonKey || 'placeholder-key'

  // Log for debugging (only in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Supabase URL:', url.substring(0, 30) + '...')
    console.log('Supabase Key set:', !!key && key !== 'placeholder-key')
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  })

  return supabaseClient
})()

// Helper function to get display name (display_name if set, otherwise username)
export function getDisplayName(profile: Profile | null | undefined): string {
  if (!profile) return 'Unknown'
  return profile.display_name || profile.username
}

// Database types (matching your Supabase schema)
export type Profile = {
  id: string
  username: string
  display_name: string | null
  name_changed_by: string | null
  is_admin: boolean
  first_completed_all_tasks_at: string | null
  avatar_level: number
  lifetime_exp: number
  gold: number
  tasks_completed_today: number
  potion_immunity_expires?: string | null
  created_at: string
}

export type Task = {
  id: string
  user_id: string
  description: string
  reward: string | null
  is_done: boolean
  task_order: number
  created_at: string
}

export type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export type ShopItem = {
  id: string
  name: string
  type: 'armour' | 'weapon' | 'potion' | 'pet' | 'name_change' | 'name_restore'
  cost: number
  effect: string | { description: string; protection?: number; damage?: number } // Can be JSONB from database or parsed object
}

export type UserInventory = {
  id: string
  user_id: string
  item_id: string
  quantity: number
}

