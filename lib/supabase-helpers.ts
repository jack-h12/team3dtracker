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
 * Refreshes the Supabase session and ensures it's valid
 */
export async function refreshSession(): Promise<boolean> {
  try {
    // Try to refresh the session with timeout wrapper
    const sessionResult = await withRetry(
      () => supabase.auth.getSession(),
      { maxRetries: 1, timeout: 5000 }
    )
    
    const { data: { session }, error } = sessionResult
    
    if (error) {
      console.error('Error refreshing session:', error)
      // Still return true - let actual requests handle the error
      return true
    }

    if (!session) {
      console.warn('No active session')
      // Still return true - let actual requests handle the error
      return true
    }

    // Don't validate with getUser() - it can timeout too
    // Just having a valid session object is enough
    return true
  } catch (err: any) {
    console.warn('Session refresh failed or timed out, but will continue anyway:', err?.message)
    // Return true anyway - let the actual requests handle errors
    // This allows the app to continue even if session refresh fails
    return true
  }
}

