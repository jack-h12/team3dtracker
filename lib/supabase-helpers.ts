/**
 * Supabase Helper Utilities
 * 
 * Helper functions for making robust Supabase requests that handle:
 * - Timeouts
 * - Retries
 * - Tab visibility issues
 */

import { supabase } from './supabase'

/**
 * Wraps a Supabase request with timeout and retry logic
 */
type RetryContext = {
  signal: AbortSignal
}

export async function withRetry<T>(
  requestFn: (context: RetryContext) => Promise<T>,
  options: {
    maxRetries?: number
    timeout?: number
    retryDelay?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, timeout = 10000, retryDelay = 1000 } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    let timedOut = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    // Use Promise.race so the timeout ALWAYS works, even if the request is
    // stuck pre-fetch (e.g. waiting for Supabase's internal auth lock).
    // AbortController.abort() only kills an in-flight fetch — it can't
    // unblock code that hasn't reached fetch() yet.
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort()
        reject(new Error('Request timeout'))
      }, timeout)
    })

    try {
      const result = await Promise.race([
        requestFn({ signal: controller.signal }),
        timeoutPromise
      ])
      clearTimeout(timeoutId)
      return result
    } catch (error: any) {
      clearTimeout(timeoutId)

      const isLastAttempt = attempt === maxRetries
      const isTimeout = timedOut || error?.message === 'Request timeout'
      const normalizedError = isTimeout ? new Error('Request timeout') : error
      const isNetworkError =
        normalizedError?.message?.includes('fetch') || normalizedError?.code === 'ECONNABORTED'

      console.warn(`Request attempt ${attempt + 1} failed:`, normalizedError?.message || normalizedError)

      if (isLastAttempt) {
        throw normalizedError
      }

      if (isTimeout || isNetworkError) {
        const delay = retryDelay * Math.pow(2, attempt)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw normalizedError
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Checks if network is available
 */
async function isNetworkAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !('navigator' in window)) return true
  
  // Check online status
  if (!navigator.onLine) return false
  
  // Try a quick fetch to verify connectivity
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    await fetch('/favicon.ico', { 
      method: 'HEAD', 
      cache: 'no-store',
      signal: controller.signal 
    })
    clearTimeout(timeoutId)
    return true
  } catch {
    return false
  }
}

/**
 * Refreshes the Supabase session token after tab switches
 */
export async function refreshSession(): Promise<void> {
  try {
    // Check network first
    if (!(await isNetworkAvailable())) {
      console.warn('Network not available, skipping session refresh')
      return
    }
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      // If error, don't try to refresh - session might be invalid
      return
    }
    
    if (session) {
      // Use a race condition to prevent infinite hanging, but don't treat timeout as error
      // Just let the background refresh happen
      try {
        await Promise.race([
          supabase.auth.refreshSession(session),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ])
      } catch (e) {
        // Ignore timeout, refresh might still complete in background
        console.log('Session refresh timed out or failed, continuing...')
      }
    }
  } catch (err) {
    // Ignore errors - session might still be valid
  }
}

// Track when tab was last hidden to detect tab switches
let lastTabHiddenTime: number | null = null
let isTabVisible = true
let visibilityListenerSetup = false

// Setup visibility listener only in browser and only once
function setupVisibilityListener() {
  if (typeof window === 'undefined' || visibilityListenerSetup) return
  
  visibilityListenerSetup = true
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      lastTabHiddenTime = Date.now()
      isTabVisible = false
    } else {
      isTabVisible = true
    }
  })
}

// Initialize on first use in browser
if (typeof window !== 'undefined') {
  setupVisibilityListener()
}

/**
 * Checks if the tab was recently hidden (within the last 5 seconds)
 * This is useful when components mount after a tab switch
 * Safe to call during SSR (returns false)
 */
export function wasTabRecentlyHidden(): boolean {
  if (typeof window === 'undefined') return false
  return lastTabHiddenTime !== null && Date.now() - lastTabHiddenTime < 5000
}


