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
import { supabase, resetSupabaseClient, forceResetSupabaseClient } from '@/lib/supabase'
import { getCurrentUser, getCurrentProfile, signOut, updatePassword } from '@/lib/auth'
import { shouldResetTasks, resetDailyTasks } from '@/lib/tasks'
import Auth from '@/components/Auth'
import Tasks from '@/components/Tasks'
import Avatar from '@/components/Avatar'
import Leaderboard from '@/components/Leaderboard'
import Friends from '@/components/Friends'
import Shop from '@/components/Shop'
import Admin from '@/components/Admin'
import HowToPlay from '@/components/HowToPlay'
import Modal from '@/components/Modal'
import { isAdmin } from '@/lib/admin'
import { setModalStateSetter, getModalState, closeModal } from '@/lib/modal'
import type { Profile } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type View = 'tasks' | 'leaderboard' | 'friends' | 'shop' | 'admin' | 'howtoplay'

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

  useEffect(() => {
    setModalStateSetter(setModalState)
  }, [])

  // Function to initialize auth and load user data
  const initAuth = async () => {
    try {
      // Note: process.env.NEXT_PUBLIC_* vars are replaced at build time by Next.js
      // They're available in both client and server, but we check here for safety
      
      // Get session with aggressive timeout detection
      // If this hangs, it means the Supabase client is stuck - we need to clear everything
      let session: any = null
      let sessionError: any = null
      let timedOut = false
      
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true
          reject(new Error('Session check timeout'))
        }, 5000) // 5 second timeout
      })
      
      try {
        const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any }, error: any }
        session = result.data?.session
        sessionError = result.error
      } catch (err: any) {
        if (timedOut) {
          // Session check timed out - this might be a temporary network blip
          console.warn('Session check timed out - proceeding with soft failure')
          // Don't force reset - that logs the user out!
          // Just set loading to false so the UI can show something (or the user can retry)
          setLoading(false)
          return
        } else {
          sessionError = err
        }
      }
      
      if (sessionError) {
        console.error('Error getting session:', sessionError)
        setLoading(false)
        return
      }
      
      if (session?.user) {
        setUser(session.user)
        // Load profile in background, don't block UI
        try {
          const userProfile = await getCurrentProfile()
          if (userProfile) {
            setProfile(userProfile)
            const adminStatus = await isAdmin(session.user.id)
            setUserIsAdmin(adminStatus)
          }
        } catch (profileError) {
          console.error('Error loading profile:', profileError)
        }
      }
      setLoading(false)
    } catch (err) {
      console.error('Error initializing auth:', err)
      setLoading(false)
      // If initAuth fails completely, don't force reset - just log
      if (err && typeof err === 'object' && 'message' in err && 
          (err.message === 'Session check timeout' || String(err.message).includes('timeout'))) {
        console.warn('Auth init failed due to timeout')
      }
    }
  }

  useEffect(() => {
    let mounted = true
    let loadingTimeout: NodeJS.Timeout | null = null
    
    // Watchdog: If loading takes too long, something is wrong
    loadingTimeout = setTimeout(() => {
      if (loading && mounted) {
        console.warn('App stuck loading for 10+ seconds - trying soft reset')
        // Just reset the client instance in memory, don't clear storage
        resetSupabaseClient()
        // Reload page as last resort but don't clear session
        setTimeout(() => {
          if (typeof window !== 'undefined' && mounted) {
            window.location.reload()
          }
        }, 1000)
      }
    }, 10000) // 10 second watchdog
    
    // Initial auth check
    initAuth().finally(() => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    })
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true)
      }

      try {
        if (session?.user) {
          setUser(session.user)
          const userProfile = await getCurrentProfile()
          if (userProfile && mounted) {
            setProfile(userProfile)
            const adminStatus = await isAdmin(session.user.id)
            if (mounted) setUserIsAdmin(adminStatus)
          }
        } else {
          setUser(null)
          setProfile(null)
          setUserIsAdmin(false)
        }
      } catch (err) {
        console.error('Error in auth state change:', err)
      }
    })

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
        const userProfile = await getCurrentProfile()
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
      const userProfile = await getCurrentProfile()
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

  const handleAuthSuccess = useCallback(async () => {
    // Refresh the session and reload profile
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadProfile(session.user.id)
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

  if (!user || !profile) {
    return (
      <>
        <Auth onAuthSuccess={handleAuthSuccess} />
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


