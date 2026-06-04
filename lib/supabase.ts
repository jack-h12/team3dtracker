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

// [DIAG] Module-level diagnostic counters used by lock + fetch wrappers below.
// Remove this whole block (and the [DIAG] log statements) once the loading bug is diagnosed.
const __diag = {
  lockSeq: 0,
  lockActive: 0,
  fetchSeq: 0,
  fetchActive: 0,
  authCallSeq: 0,
}
if (typeof window !== 'undefined') {
  ;(window as any).__supabaseDiag = __diag
  console.log('[DIAG] supabase.ts module loaded at', new Date().toISOString())
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
      lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
        // [DIAG] Instrumented to log every lock acquisition with concurrency count.
        const id = ++__diag.lockSeq
        __diag.lockActive++
        const start = performance.now()
        console.log(`[DIAG][lock] enter #${id} name=${name} timeout=${acquireTimeout} active=${__diag.lockActive}`)
        try {
          return await fn()
        } finally {
          const elapsed = Math.round(performance.now() - start)
          __diag.lockActive--
          console.log(`[DIAG][lock] exit  #${id} name=${name} elapsed=${elapsed}ms active=${__diag.lockActive}`)
        }
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

        // [DIAG] Instrumented to log every HTTP request with URL category and timing.
        const id = ++__diag.fetchSeq
        const urlStr = typeof input === 'string'
          ? input
          : input instanceof URL ? input.toString()
          : (input as Request).url
        const path = (() => { try { return new URL(urlStr).pathname } catch { return urlStr } })()
        const category = path.includes('/auth/') ? 'auth' : path.includes('/rest/') ? 'rest' : path.includes('/storage/') ? 'storage' : 'other'
        const method = init?.method || 'GET'
        __diag.fetchActive++
        const start = performance.now()
        console.log(`[DIAG][fetch] start #${id} ${method} ${category} ${path} active=${__diag.fetchActive}`)

        try {
          const response = await fetch(input, { ...init, signal: controller.signal })
          clearTimeout(timeoutId)
          const elapsed = Math.round(performance.now() - start)
          __diag.fetchActive--
          console.log(`[DIAG][fetch] done  #${id} status=${response.status} elapsed=${elapsed}ms active=${__diag.fetchActive}`)
          return response
        } catch (err: any) {
          clearTimeout(timeoutId)
          const elapsed = Math.round(performance.now() - start)
          __diag.fetchActive--
          const reason = controller.signal.aborted ? 'aborted' : (err?.name || 'error')
          console.log(`[DIAG][fetch] FAIL  #${id} reason=${reason} msg=${err?.message} elapsed=${elapsed}ms active=${__diag.fetchActive}`)
          throw err
        }
      }
    }
  })

  supabaseClient = client
  return client
}

export let supabase = createSupabaseClient()

// [DIAG] Monkey-patch auth methods to log entry/exit timing and outcome.
// Remove this block once the loading bug is diagnosed.
if (typeof window !== 'undefined') {
  const wrapAuthMethod = <K extends 'getSession' | 'refreshSession' | 'startAutoRefresh' | 'stopAutoRefresh' | 'getUser'>(name: K) => {
    const auth: any = supabase.auth
    const original = auth[name]?.bind(auth)
    if (!original) return
    auth[name] = async (...args: any[]) => {
      const id = ++__diag.authCallSeq
      const start = performance.now()
      console.log(`[DIAG][auth] start #${id} ${name}`)
      try {
        const result = await original(...args)
        const elapsed = Math.round(performance.now() - start)
        const summary = result?.error
          ? `error=${result.error.message}`
          : result?.data?.session
            ? `session.expires_at=${result.data.session.expires_at} (in ${result.data.session.expires_at ? Math.round(result.data.session.expires_at - Date.now() / 1000) : '?'}s)`
            : 'ok'
        console.log(`[DIAG][auth] done  #${id} ${name} elapsed=${elapsed}ms ${summary}`)
        return result
      } catch (err: any) {
        const elapsed = Math.round(performance.now() - start)
        console.log(`[DIAG][auth] FAIL  #${id} ${name} elapsed=${elapsed}ms err=${err?.message}`)
        throw err
      }
    }
  }
  wrapAuthMethod('getSession')
  wrapAuthMethod('refreshSession')
  wrapAuthMethod('startAutoRefresh')
  wrapAuthMethod('stopAutoRefresh')
  wrapAuthMethod('getUser')

  // Log every auth state change event so we can see TOKEN_REFRESHED / SIGNED_IN ordering.
  supabase.auth.onAuthStateChange((event, session) => {
    const expIn = session?.expires_at ? Math.round(session.expires_at - Date.now() / 1000) : null
    console.log(`[DIAG][auth] event=${event} hasSession=${!!session} expIn=${expIn}s`)
  })
}

// On cold open, supabase-js leaves auto-refresh to a hidden→visible
// visibilitychange event that never fires (the tab was never hidden).
// Kick it off explicitly so the persisted token gets refreshed instead
// of every query queueing behind a refresh that never happens.
if (typeof window !== 'undefined') {
  supabase.auth.startAutoRefresh()
}

// ── Tab-visibility session recovery ──────────────────────────────────
// When the browser tab is hidden and later revealed, the Supabase auth
// state can go stale. This listener tells Supabase to re-validate the
// session so that subsequent data queries use a fresh token.
//
// We delay startAutoRefresh slightly so it doesn't race with
// initAuth's getSession() call on first load. Without this, both can
// try to refresh the same token simultaneously (the lock bypass means
// they aren't serialised), one invalidates the token the other needs,
// and the losing call fails → login appears to hang.
if (typeof window !== 'undefined') {
  let autoRefreshPaused = false

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (autoRefreshPaused) {
        autoRefreshPaused = false
        // Small delay avoids racing with any getSession() call that
        // fires immediately on tab-visible in component handlers.
        setTimeout(() => supabase.auth.startAutoRefresh(), 2000)
      }
    } else {
      autoRefreshPaused = true
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
  task_date: string // YYYY-MM-DD, day the task belongs to (in Eastern task-day terms)
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
  type: 'armour' | 'weapon' | 'potion' | 'pet' | 'name_change' | 'name_restore' | 'display_name_restore' | 'bankrob' | 'item_steal'
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

export type DailyTaskSnapshot = {
  id: string
  user_id: string
  snapshot_date: string
  description: string
  reward: string | null
  is_done: boolean
  task_order: number
  created_at: string
}

export type DailyLeaderboardSnapshot = {
  id: string
  snapshot_date: string
  user_id: string
  username: string
  display_name: string | null
  avatar_level: number
  tasks_completed_today: number
  completed_all_tasks_at: string | null
  lifetime_exp: number
  rank: number
  created_at: string
}

export type DailyNote = {
  id: string
  user_id: string
  note_date: string
  content: string
  updated_at: string
}
