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
import type { SupabaseClient } from '@supabase/supabase-js'

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

// Track the active client so we can fully reset/replace it when needed
let supabaseClient: SupabaseClient | null = null
let isResettingClient = false
let lastResetTimestamp = 0
const RESET_THROTTLE_MS = 2000

/**
 * Clears stale Supabase session data from localStorage
 * This helps recover from persistent connection issues
 * Only clears auth tokens, preserves other app data
 */
export function clearStaleSessionData() {
  if (typeof window === 'undefined') return
  
  try {
    const keys = Object.keys(localStorage)
    let clearedCount = 0
    keys.forEach(key => {
      // Clear only Supabase auth token keys (not other app data)
      // Supabase stores tokens with pattern: sb-<project-ref>-auth-token
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key)
        clearedCount++
      }
      // Also clear old format if it exists
      if (key.startsWith('supabase.auth.token')) {
        localStorage.removeItem(key)
        clearedCount++
      }
    })
    if (clearedCount > 0) {
      console.log(`Cleared ${clearedCount} stale Supabase session token(s) from localStorage`)
    }
  } catch (e) {
    console.warn('Error clearing localStorage:', e)
  }
}

/**
 * Resets the Supabase client - forces a fresh connection on the next request
 */
export function resetSupabaseClient(options?: { force?: boolean }) {
  const now = Date.now()
  if (!options?.force) {
    if (isResettingClient) {
      return
    }
    if (now - lastResetTimestamp < RESET_THROTTLE_MS) {
      return
    }
  }

  isResettingClient = true
  lastResetTimestamp = now

  try {
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

    // Drop the existing reference and build a fresh client
    supabaseClient = null
    supabase = createSupabaseClient()
  } finally {
    isResettingClient = false
    if (options?.force) {
      lastResetTimestamp = Date.now()
    }
  }
}

/**
 * Force reset - clears session data and resets client
 * Use this when normal reset doesn't work
 */
export function forceResetSupabaseClient() {
  clearStaleSessionData()
  resetSupabaseClient({ force: true })
}

function createSupabaseClient(): SupabaseClient {
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

  const client = createClient(url, key, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      // Disabled: we handle PKCE code exchange manually in page.tsx
      // to ensure the onAuthStateChange listener is registered first
      // (so PASSWORD_RECOVERY events are caught).
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce',
      // Bypass the Web Locks API (navigator.locks). Supabase uses it to
      // coordinate token refreshes across browser tabs, but it causes the
      // entire app to freeze after tab switches: the auto-refresh grabs an
      // exclusive lock with no timeout, and every data query internally calls
      // getSession() which waits for the same lock forever. Without the lock,
      // the worst case is a redundant token refresh when multiple tabs are open.
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
        return await fn()
      }
    },
    global: {
      // Global fetch wrapper with a hard timeout. This ensures that even
      // internal auth operations (like auto token refresh after a tab switch)
      // can't hang forever and hold the auth lock, which would block all queries.
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const GLOBAL_TIMEOUT = 15000
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT)

        // If the caller already has an abort signal, link it to ours
        if (init?.signal) {
          if (init.signal.aborted) {
            controller.abort()
          } else {
            init.signal.addEventListener('abort', () => controller.abort())
          }
        }

        try {
          const response = await fetch(input, { ...init, signal: controller.signal })
          clearTimeout(timeoutId)
          return response
        } catch (err) {
          clearTimeout(timeoutId)
          throw err
        }
      }
    }
  })

  supabaseClient = client
  return client
}

export let supabase = createSupabaseClient()

// ── Tab-visibility session recovery ──────────────────────────────────
// When the browser tab is hidden and later revealed, the Supabase auth
// state can go stale. This single, module-level listener fires *before*
// any component-level visibilitychange handlers (because the module is
// imported before components mount) and tells Supabase to re-validate
// the session so that subsequent data queries use a fresh token.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // startAutoRefresh re-enables the internal ticker AND runs the
      // recovery flow that reads the session from storage, checks
      // expiry, and refreshes the token if needed.
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}

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
  completed_all_tasks_at: string | null
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
