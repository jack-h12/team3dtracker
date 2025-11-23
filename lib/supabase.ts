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

// Get env vars - Next.js replaces NEXT_PUBLIC_* vars at build time
// They're available in both browser and server contexts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.warn('For localhost: Create a .env.local file with these variables')
    console.warn('For Vercel: Set these in your Vercel project environment variables')
  }
}

// Create a singleton client instance
let supabaseClient: ReturnType<typeof createClient> | null = null

/**
 * Resets the Supabase client - forces a fresh connection on the next request
 */
export function resetSupabaseClient() {
  if (supabaseClient) {
    try {
      // Only disconnect realtime if we're in browser and it's connected
      if (typeof window !== 'undefined' && supabaseClient.realtime) {
        supabaseClient.realtime.disconnect()
      }
    } catch (e) {
      // Ignore errors
    }
  }
  supabaseClient = null
}

export const supabase = (() => {
  if (supabaseClient) {
    return supabaseClient
  }

  // Use env vars directly - fallback to placeholder only if truly missing
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseAnonKey || 'placeholder-key'

  // Validate that we have real values (not placeholders)
  // Only warn in browser to avoid build errors
  if (typeof window !== 'undefined') {
    if (url.includes('placeholder') || key.includes('placeholder')) {
      console.error('Supabase not configured properly. Using placeholder values. The app will not work until environment variables are set.')
    }
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Supabase initialized:', {
        urlSet: !!url && !url.includes('placeholder'),
        keySet: !!key && !key.includes('placeholder'),
        urlPreview: url.substring(0, 30) + (url.length > 30 ? '...' : '')
      })
    }
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce'
    },
    db: {
      schema: 'public'
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
  expires_at?: string | null // Expiration date for armour items (2 weeks from purchase)
}

