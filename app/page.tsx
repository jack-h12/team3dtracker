/**
 * Main App Page
 * 
 * This is the root page of the application. It handles:
 * - Authentication state management
 * - Routing between different views (Tasks, Leaderboard, Friends, Shop)
 * - Loading user profile and displaying avatar
 * - Daily task reset checking
 * 
 * The app uses Supabase for all backend operations:
 * - Authentication via Supabase Auth
 * - Data operations via Supabase client (profiles, tasks, friend_requests, shop_items, user_inventory tables)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileById, signOut, updatePassword } from '@/lib/auth'
import Auth from '@/components/Auth'
import Tasks from '@/components/Tasks'
import Avatar from '@/components/Avatar'
import Leaderboard from '@/components/Leaderboard'
import Friends from '@/components/Friends'
import Shop from '@/components/Shop'
import Admin from '@/components/Admin'
import HowToPlay from '@/components/HowToPlay'
import Calendar from '@/components/Calendar'
import Testosterone from '@/components/Testosterone'
import Lifts from '@/components/Lifts'
import Modal from '@/components/Modal'
import Inbox from '@/components/Inbox'
import { isAdmin } from '@/lib/admin'
import { setModalStateSetter, getModalState, closeModal } from '@/lib/modal'
import type { Profile } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type View = 'tasks' | 'leaderboard' | 'friends' | 'shop' | 'admin' | 'howtoplay' | 'calendar' | 'testosterone' | 'lifts'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<View>('tasks')
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [modalState, setModalState] = useState(getModalState())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordResetError, setPasswordResetError] = useState('')
  const [passwordResetLoading, setPasswordResetLoading] = useState(false)
  const [resetCountdown, setResetCountdown] = useState('')

  useEffect(() => {
    setModalStateSetter(setModalState)
  }, [])

  // Countdown timer to 5 PM EST reset
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      // Get current time in EST (America/New_York handles EST/EDT automatically)
      const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const resetTime = new Date(estNow)
      resetTime.setHours(17, 0, 0, 0) // 5 PM

      // If past 5 PM EST today, target tomorrow's 5 PM
      if (estNow >= resetTime) {
        resetTime.setDate(resetTime.getDate() + 1)
      }

      const diff = resetTime.getTime() - estNow.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setResetCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let mounted = true
    let loadingTimeout: NodeJS.Timeout | null = null
    let initialLoadHandled = false

    // Watchdog: if initial load hasn't finished after 20s, stop the spinner
    // so the user isn't stuck on a blank screen indefinitely.
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('App stuck loading for 20+ seconds - giving up on init')
        setLoading(false)
      }
    }, 20000)

    // Capture PKCE code before registering the listener (prevents reload loops)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true)
        return
      }

      // All initial-load handling happens in runInit() below. The listener
      // only handles post-initial events (SIGNED_IN after login, SIGNED_OUT,
      // TOKEN_REFRESHED).
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        setUser(session.user)
        try {
          const userProfile = await getProfileById(session.user.id)
          if (userProfile && mounted) {
            setProfile(userProfile)
            const adminStatus = await isAdmin(session.user.id)
            if (mounted) setUserIsAdmin(adminStatus)
          }
        } catch (err) {
          console.error('Profile load failed on auth event:', event, err)
          // The bounded recovery effect will retry.
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setUserIsAdmin(false)
      }
    })

    // Initial load: read the persisted session and fetch the profile
    // directly. We deliberately do NOT call refreshSession() here —
    // Supabase auto-refresh handles stale tokens lazily, and a proactive
    // refresh on every cold open blocks the UI behind a 15s network call
    // when the network is slow. If the access token is genuinely expired,
    // the profile fetch will 401, which the recovery effect then retries
    // with a forced refresh.
    const runInit = async () => {
      if (initialLoadHandled) return
      initialLoadHandled = true

      try {
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code)
            return // SIGNED_IN / PASSWORD_RECOVERY listener takes over
          } catch (err) {
            console.error('Error exchanging auth code:', err)
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return // signed out

        if (!mounted) return
        setUser(session.user)

        try {
          const userProfile = await getProfileById(session.user.id)
          if (userProfile && mounted) {
            setProfile(userProfile)
            const adminStatus = await isAdmin(session.user.id)
            if (mounted) setUserIsAdmin(adminStatus)
          }
        } catch (profileError) {
          console.error('Initial profile load failed:', profileError)
          // Recovery effect will retry with a forced refresh.
        }
      } finally {
        if (mounted) {
          if (loadingTimeout) clearTimeout(loadingTimeout)
          setLoading(false)
        }
      }
    }
    runInit()

    // Session recovery on tab switch is handled by the module-level
    // visibilitychange listener in lib/supabase.ts (startAutoRefresh /
    // stopAutoRefresh).  This component just refreshes profile data
    // once Supabase has had a chance to recover the session.
    const handleVisibilityChange = async () => {
      if (!mounted || document.hidden) return

      // Give the module-level listener time to kick off the session refresh
      await new Promise(resolve => setTimeout(resolve, 1500))

      if (!mounted || document.hidden) return

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted || !session?.user) return

        setUser(session.user)
        const userProfile = await getProfileById(session.user.id)
        if (userProfile && mounted) {
          setProfile(userProfile)
          const adminStatus = await isAdmin(session.user.id)
          if (mounted) setUserIsAdmin(adminStatus)
        }
      } catch (err) {
        console.warn('Error refreshing profile after tab switch:', err)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const userProfile = await getProfileById(userId)
      if (userProfile) {
        setProfile(userProfile)
        // Check if user is admin
        const adminStatus = await isAdmin(userId)
        setUserIsAdmin(adminStatus)
        
        // If user is not admin but somehow on admin view, redirect to tasks
        setCurrentView(prev => !adminStatus && prev === 'admin' ? 'tasks' : prev)
      }
      
      // Only check for daily reset on initial load, not every time profile is reloaded
      // The reset check should happen in the Tasks component, not here
      // This prevents reset from triggering when tasks are completed
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }, [])

  const handleAuthSuccess = useCallback(async (session?: { user: { id: string } }) => {
    // Use the session passed directly from signIn when available — this avoids
    // a redundant getSession() call that can race with onAuthStateChange and fail.
    try {
      let sessionUser: User | null = null

      if (session?.user) {
        // We have a partial user from Auth.tsx — read the full user from the
        // Supabase client which should have it cached from the signIn call.
        const { data: { session: fullSession } } = await supabase.auth.getSession()
        sessionUser = fullSession?.user ?? null

        // If getSession still failed, construct a minimal user to unblock
        // profile loading — the onAuthStateChange listener will set the
        // full user shortly.
        if (!sessionUser) {
          sessionUser = { id: session.user.id } as User
        }
      } else {
        // Fallback: read from Supabase if no session was passed (e.g. signup flow)
        await new Promise(r => setTimeout(r, 500))
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        sessionUser = currentSession?.user ?? null
      }

      if (sessionUser) {
        setUser(sessionUser)
        await loadProfile(sessionUser.id)
      }
    } catch (err) {
      console.error('handleAuthSuccess error (non-fatal):', err)
    }
  }, [loadProfile])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      setUser(null)
      setProfile(null)
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }, [])

  const handleTaskComplete = useCallback(async (updatedProfile?: Profile) => {
    if (updatedProfile) {
      // Use the provided profile to avoid re-fetching
      setProfile(updatedProfile)
    } else if (user) {
      // Fallback: fetch profile if not provided
      await loadProfile(user.id)
    }
  }, [user, loadProfile])

  const handlePurchase = useCallback(async () => {
    if (user) {
      await loadProfile(user.id)
    }
  }, [user, loadProfile])

  // Recovery effect: if we have a user but no profile (e.g. profile load
  // failed during init), retry a bounded number of times. After this
  // budget, the "Loading your profile..." screen's Refresh button is the
  // escape hatch — better than an infinite spinner that hides a real error.
  useEffect(() => {
    if (!user || profile || loading) return

    let cancelled = false
    const recover = async () => {
      const delays = [500, 1500, 3000, 5000]
      for (let i = 0; i < delays.length; i++) {
        await new Promise(r => setTimeout(r, delays[i]))
        if (cancelled) return
        console.warn(`Profile recovery attempt ${i + 1}/${delays.length}`)

        try {
          await supabase.auth.refreshSession()
        } catch {
          // Ignore — getProfileById below will surface any real auth error.
        }
        if (cancelled) return

        try {
          const userProfile = await getProfileById(user.id)
          if (userProfile && !cancelled) {
            setProfile(userProfile)
            const adminStatus = await isAdmin(user.id)
            if (!cancelled) setUserIsAdmin(adminStatus)
            return
          }
        } catch (err) {
          console.error(`Profile recovery attempt ${i + 1} failed:`, err)
        }
      }
    }

    recover()
    return () => { cancelled = true }
  }, [user, profile, loading])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordResetError('')

    if (newPassword.length < 6) {
      setPasswordResetError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordResetError('Passwords do not match')
      return
    }

    setPasswordResetLoading(true)
    try {
      await updatePassword(newPassword)
      setShowPasswordReset(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordResetError(err.message || 'Failed to update password')
    } finally {
      setPasswordResetLoading(false)
    }
  }

  // Password reset modal — rendered as a fixed overlay on any screen
  const passwordResetModal = showPasswordReset ? (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        padding: '35px',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>SET NEW PASSWORD</h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '25px' }}>
          Enter your new password below
        </p>
        <form onSubmit={handlePasswordReset}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontWeight: 600, fontSize: '14px' }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                boxSizing: 'border-box',
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
              required
              minLength={6}
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontWeight: 600, fontSize: '14px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                boxSizing: 'border-box',
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
              required
              minLength={6}
            />
          </div>
          {passwordResetError && (
            <div style={{
              color: '#ff4444',
              marginBottom: '20px',
              padding: '14px',
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {passwordResetError}
            </div>
          )}
          <button
            type="submit"
            disabled={passwordResetLoading}
            style={{
              width: '100%',
              padding: '16px',
              background: passwordResetLoading
                ? 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
                : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: passwordResetLoading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '16px',
              boxShadow: passwordResetLoading ? 'none' : '0 8px 25px rgba(255, 107, 53, 0.4)'
            }}
          >
            {passwordResetLoading ? 'Updating...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  ) : null

  if (loading) {
    return (
      <>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #2a2a2a',
              borderTop: '4px solid #ff6b35',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Loading...</p>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        {passwordResetModal}
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Auth onAuthSuccess={handleAuthSuccess} />
        {passwordResetModal}
      </>
    )
  }

  if (!profile) {
    // User is authenticated but profile hasn't loaded yet — show a loading
    // screen instead of the login form. The recovery effect will retry.
    return (
      <>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #2a2a2a',
              borderTop: '4px solid #ff6b35',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>Loading your profile...</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                color: '#ccc',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                marginBottom: '10px'
              }}
            >
              Refresh Page
            </button>
            <br />
            <button
              onClick={async () => {
                await signOut()
                setUser(null)
                setProfile(null)
              }}
              style={{
                padding: '8px 20px',
                background: 'transparent',
                color: '#666',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '12px',
                marginTop: '8px'
              }}
            >
              Sign out instead
            </button>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        {passwordResetModal}
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)' }}>
      {/* Header */}
      <header style={{ 
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        borderBottom: '2px solid #ff6b35',
        padding: '15px 0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          maxWidth: '1400px', 
          margin: '0 auto',
          padding: '0 15px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                padding: '10px',
                background: 'transparent',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '24px',
                lineHeight: '1'
              }}
              className="mobile-menu-btn"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
            <img
              src="/team3dicon.webp"
              alt="Team3D Logo"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                objectFit: 'cover',
                boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)'
              }}
              className="header-logo"
            />
            <h1 style={{ 
              margin: 0, 
              fontSize: 'clamp(18px, 4vw, 28px)',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>TEAM3D TRACKER</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Reset Countdown */}
            <div style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid #3a3a3a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.2
            }} className="reset-countdown">
              <span style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reset in</span>
              <span style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', fontWeight: 700, color: '#ff6b35', fontVariantNumeric: 'tabular-nums' }}>{resetCountdown}</span>
            </div>
            <Inbox userId={user.id} />
            <div style={{
              padding: '6px 12px',
              background: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              fontWeight: 600,
              fontSize: 'clamp(11px, 2.5vw, 14px)',
              color: '#ff6b35',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '150px'
            }} className="header-username">{profile.display_name || profile.username}</div>
            <button
              onClick={handleSignOut}
              style={{ 
                padding: '8px 16px', 
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                color: '#fff', 
                border: '1px solid #3a3a3a',
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
                e.currentTarget.style.borderColor = '#ff6b35'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                e.currentTarget.style.borderColor = '#3a3a3a'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(15px, 3vw, 30px)' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(0, 320px) 1fr', 
          gap: 'clamp(15px, 3vw, 30px)'
        }}
        className="main-layout"
        >
          {/* Sidebar */}
          <aside 
            style={{
              display: mobileMenuOpen ? 'block' : 'none'
            }}
            className={`sidebar-mobile ${mobileMenuOpen ? 'menu-open' : 'menu-closed'}`}
          >
            <Avatar profile={profile} />
            
            {/* Navigation */}
            <nav style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const navItems = [
                  { id: 'tasks', label: 'Tasks', icon: '💪' },
                  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
                  { id: 'friends', label: 'Friends', icon: '👥' },
                  { id: 'shop', label: 'Shop', icon: '🛒' },
                  { id: 'calendar', label: 'Calendar', icon: '📅' },
                  { id: 'lifts', label: 'Lifts', icon: '🏋️' },
                  { id: 'testosterone', label: '10 T Commandments', icon: '⚡' },
                  { id: 'howtoplay', label: 'How to Play', icon: '📖' }
                ]
                
                // Only add admin tab if user is actually an admin
                if (userIsAdmin || profile?.is_admin) {
                  navItems.push({ id: 'admin', label: 'Admin', icon: '👑' })
                }
                
                return navItems
              })().map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View)
                    setMobileMenuOpen(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    background: currentView === item.id 
                      ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
                      : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                    color: currentView === item.id ? '#fff' : '#ccc',
                    border: currentView === item.id ? 'none' : '1px solid #3a3a3a',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: currentView === item.id ? 700 : 600,
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    boxShadow: currentView === item.id 
                      ? '0 4px 20px rgba(255, 107, 53, 0.4)'
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (currentView !== item.id) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
                      e.currentTarget.style.borderColor = '#ff6b35'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentView !== item.id) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)'
                      e.currentTarget.style.borderColor = '#3a3a3a'
                    }
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main style={{ 
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '16px', 
            padding: 'clamp(15px, 3vw, 30px)', 
            minHeight: '500px',
            border: '1px solid #3a3a3a',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            width: '100%',
            overflowX: 'hidden'
          }}>
            {currentView === 'tasks' && (
              <Tasks userId={user.id} onTaskComplete={handleTaskComplete} />
            )}
            {currentView === 'leaderboard' && <Leaderboard />}
            {currentView === 'friends' && <Friends userId={user.id} />}
            {currentView === 'shop' && (
              <Shop userId={user.id} onPurchase={handlePurchase} />
            )}
            {currentView === 'calendar' && <Calendar userId={user.id} />}
            {currentView === 'lifts' && <Lifts userId={user.id} />}
            {currentView === 'testosterone' && <Testosterone userId={user.id} />}
            {currentView === 'howtoplay' && <HowToPlay />}
            {currentView === 'admin' ? (
              userIsAdmin ? (
                <Admin userId={user.id} />
              ) : (
                <div style={{
                  padding: '60px 40px',
                  background: '#0a0a0a',
                  borderRadius: '12px',
                  border: '1px solid #3a3a3a',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔒</div>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: '#fff',
                    marginBottom: '12px',
                    letterSpacing: '-0.5px'
                  }}>ACCESS DENIED</h3>
                  <p style={{ color: '#888', fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>
                    You don't have admin privileges.
                  </p>
                  <button
                    onClick={() => setCurrentView('tasks')}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '14px'
                    }}
                  >
                    Go to Tasks
                  </button>
                </div>
              )
            ) : null}
          </main>
        </div>
      </div>
      
      {passwordResetModal}

      {/* Global Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onConfirm={modalState.onConfirm}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
      />
    </div>
  )
}


