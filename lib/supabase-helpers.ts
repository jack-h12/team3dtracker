/**
 * Supabase Helper Utilities
 * 
 * Helper functions for making robust Supabase requests that handle:
 * - Timeouts
 * - Retries
 * - Tab visibility issues
 */

import { supabase, resetSupabaseClient, abortAllPendingRequests } from './supabase'

/**
 * Wraps a Supabase request with timeout and retry logic
 */
export async function withRetry<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number
    timeout?: number
    retryDelay?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, timeout = 10000, retryDelay = 1000 } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      })

      // Race between the request and timeout
      const result = await Promise.race([
        requestFn(),
        timeoutPromise
      ])

      return result
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries
      const isTimeout = error?.message === 'Request timeout'
      const isNetworkError = error?.message?.includes('fetch') || error?.code === 'ECONNABORTED'

      console.warn(`Request attempt ${attempt + 1} failed:`, error?.message || error)

      if (isLastAttempt) {
        throw error
      }

      // Only retry on timeout or network errors
      if (isTimeout || isNetworkError) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Don't retry on other errors (auth errors, validation errors, etc.)
      throw error
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
    
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await Promise.race([
        supabase.auth.refreshSession(session),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ])
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


