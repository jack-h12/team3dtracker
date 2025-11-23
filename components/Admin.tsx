/**
 * Admin Component
 * 
 * Admin panel with Creative Mode - full control over users:
 * - View all users with detailed stats
 * - Promote/demote users to/from admin
 * - Delete users
 * - Modify user stats (gold, EXP, level)
 * - Delete user tasks
 * - Reset user data
 * - Change usernames
 * 
 * Only accessible to admin users.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  isAdmin,
  promoteToAdmin,
  demoteFromAdmin,
  getAllUsers,
  deleteUser,
  deleteUserTasks,
  updateUserGold,
  updateUserExp,
  updateUserLevel,
  resetUserData,
  updateUserUsername,
  resetAllUsersDailyProgress
} from '@/lib/admin'
import { getDisplayName } from '@/lib/supabase'
import { showModal, showConfirm } from '@/lib/modal'
import { getAvatarImage } from '@/lib/utils'
import { refreshSession, wasTabRecentlyHidden } from '@/lib/supabase-helpers'
import { resetSupabaseClient, abortAllPendingRequests } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

interface AdminProps {
  userId: string
}

export default function Admin({ userId }: AdminProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [editValues, setEditValues] = useState<Record<string, { gold?: string; exp?: string; level?: string; username?: string }>>({})

  const mountedRef = useRef(true)

  const checkAdminAndLoad = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const adminStatus = await isAdmin(userId)
      if (mountedRef.current) {
        setUserIsAdmin(adminStatus)
      }
      
      if (adminStatus) {
        const allUsers = await getAllUsers()
        if (mountedRef.current) {
          setUsers(allUsers)
          // Initialize edit values with current user data
          const initialValues: Record<string, { gold?: string; exp?: string; level?: string; username?: string }> = {}
          allUsers.forEach(user => {
            initialValues[user.id] = {
              gold: user.gold.toString(),
              exp: user.lifetime_exp.toString(),
              level: user.avatar_level.toString(),
              username: user.username
            }
          })
          setEditValues(initialValues)
        }
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
    } finally {
      if (mountedRef.current && !silent) {
        setLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    mountedRef.current = true
    
    // If tab was recently hidden, reset client before first load
    const initializeAndLoad = async () => {
      if (wasTabRecentlyHidden()) {
        abortAllPendingRequests()
        resetSupabaseClient()
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      if (mountedRef.current) {
        checkAdminAndLoad()
      }
    }
    initializeAndLoad()
    
    // Refresh data when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.hidden || !mountedRef.current) return
      
      abortAllPendingRequests()
      resetSupabaseClient()
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (document.hidden || !mountedRef.current) return
      
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }
      
      refreshSession().catch(() => {})
      
      setTimeout(() => {
        if (!document.hidden && mountedRef.current) {
          checkAdminAndLoad(true)
        }
      }, 1500)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkAdminAndLoad])

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handlePromote = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    
    const confirmed = await showConfirm('Promote to Admin', 'Promote this user to admin?')
    if (!confirmed) return

    setActionLoading(true)
    try {
      await promoteToAdmin(userId, targetUserId)
      await checkAdminAndLoad()
      await showModal('Success', 'User promoted to admin!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to promote user', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  const handleDemote = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    
    const confirmed = await showConfirm('Demote from Admin', 'Remove admin status from this user?')
    if (!confirmed) return

    setActionLoading(true)
    try {
      await demoteFromAdmin(userId, targetUserId)
      await checkAdminAndLoad()
      await showModal('Success', 'Admin status removed!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to demote user', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  const handleDeleteUser = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    
    const confirmed = await showConfirm(
      'Delete User',
      '⚠️ WARNING: This will permanently delete this user and ALL their data (tasks, inventory, etc.). This cannot be undone!'
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      await deleteUser(userId, targetUserId)
      await checkAdminAndLoad()
      await showModal('Success', 'User deleted successfully!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to delete user', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  const handleDeleteTasks = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    
    const confirmed = await showConfirm('Delete Tasks', 'Delete all tasks for this user?')
    if (!confirmed) return

    setActionLoading(true)
    try {
      await deleteUserTasks(userId, targetUserId)
      await checkAdminAndLoad()
      await showModal('Success', 'All tasks deleted!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to delete tasks', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  const handleResetUser = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    
    const confirmed = await showConfirm(
      'Reset User Data',
      'Reset this user\'s level and tasks? (Gold and EXP will be kept)'
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      await resetUserData(userId, targetUserId)
      await checkAdminAndLoad()
      await showModal('Success', 'User data reset!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to reset user', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  const handleUpdateGold = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    const goldValue = editValues[targetUserId]?.gold
    if (!goldValue) return

    const gold = parseInt(goldValue)
    if (isNaN(gold) || gold < 0) {
      await showModal('Error', 'Please enter a valid gold amount (0 or higher)', 'error')
      return
    }

    setActionLoading(true)
    try {
      await updateUserGold(userId, targetUserId, gold)
      await checkAdminAndLoad()
      await showModal('Success', `Gold updated to ${gold}!`, 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to update gold', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad, editValues])

  const handleUpdateExp = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    const expValue = editValues[targetUserId]?.exp
    if (!expValue) return

    const exp = parseInt(expValue)
    if (isNaN(exp) || exp < 0) {
      await showModal('Error', 'Please enter a valid EXP amount (0 or higher)', 'error')
      return
    }

    setActionLoading(true)
    try {
      await updateUserExp(userId, targetUserId, exp)
      await checkAdminAndLoad()
      await showModal('Success', `EXP updated to ${exp}!`, 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to update EXP', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad, editValues])

  const handleUpdateLevel = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    const levelValue = editValues[targetUserId]?.level
    if (!levelValue) return

    const level = parseInt(levelValue)
    if (isNaN(level) || level < 0 || level > 10) {
      await showModal('Error', 'Please enter a valid level (0-10)', 'error')
      return
    }

    setActionLoading(true)
    try {
      await updateUserLevel(userId, targetUserId, level)
      await checkAdminAndLoad()
      await showModal('Success', `Level updated to ${level}!`, 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to update level', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad, editValues])

  const handleUpdateUsername = useCallback(async (targetUserId: string) => {
    if (actionLoading) return
    const username = editValues[targetUserId]?.username
    if (!username || username.trim().length === 0) {
      await showModal('Error', 'Please enter a username', 'error')
      return
    }

    setActionLoading(true)
    try {
      await updateUserUsername(userId, targetUserId, username.trim())
      await checkAdminAndLoad()
      await showModal('Success', 'Username updated!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to update username', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad, editValues])

  const updateEditValue = (userId: string, field: 'gold' | 'exp' | 'level' | 'username', value: string) => {
    setEditValues(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }))
  }

  const handleResetAllDailyProgress = useCallback(async () => {
    if (actionLoading) return
    
    const confirmed = await showConfirm(
      'Reset All Daily Progress',
      '⚠️ WARNING: This will reset daily progress for ALL users:\n\n• All tasks will be deleted\n• All avatar levels will be reset to 0\n• All daily task counters will be reset to 0\n\nThis cannot be undone! Continue?'
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      await resetAllUsersDailyProgress(userId)
      await checkAdminAndLoad()
      await showModal('Success', 'Daily progress reset for all users!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to reset daily progress', 'error')
    } finally {
      setActionLoading(false)
    }
  }, [userId, actionLoading, checkAdminAndLoad])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
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
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!userIsAdmin) {
    return (
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
        }}>ADMIN ACCESS REQUIRED</h3>
        <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
          You need admin privileges to access this panel.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 50%, #ffd700 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>ADMIN PANEL - CREATIVE MODE</h2>
        <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>
          Full control over users • Modify stats • Delete users • Manage everything
        </p>
      </div>

      {/* Global Actions */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #1a0a0a 0%, #2a1a1a 100%)',
        border: '2px solid #ff4444',
        borderRadius: '12px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 700,
          margin: '0 0 15px 0',
          color: '#ff6b35'
        }}>
          ⚡ GLOBAL ACTIONS
        </h3>
        <button
          onClick={handleResetAllDailyProgress}
          disabled={actionLoading}
          style={{
            padding: '14px 24px',
            background: actionLoading
              ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
              : 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            width: '100%'
          }}
        >
          {actionLoading ? '⏳ Resetting...' : '🔄 Reset Daily Progress for ALL Users'}
        </button>
        <p style={{
          color: '#888',
          fontSize: '12px',
          marginTop: '10px',
          marginBottom: 0,
          fontStyle: 'italic'
        }}>
          This resets all tasks, avatar levels, and daily counters for every user (like the 5pm reset)
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '12px'
        }}>
          <div style={{ color: '#888', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>TOTAL USERS</div>
          <div style={{ color: '#fff', fontSize: '28px', fontWeight: 800 }}>{users.length}</div>
        </div>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '12px'
        }}>
          <div style={{ color: '#888', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>ADMINS</div>
          <div style={{ color: '#ffd700', fontSize: '28px', fontWeight: 800 }}>
            {users.filter(u => u.is_admin).length}
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '12px'
        }}>
          <div style={{ color: '#888', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>TOTAL EXP</div>
          <div style={{ color: '#4caf50', fontSize: '28px', fontWeight: 800 }}>
            {users.reduce((sum, u) => sum + u.lifetime_exp, 0).toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '12px'
        }}>
          <div style={{ color: '#888', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>TOTAL GOLD</div>
          <div style={{ color: '#ffd700', fontSize: '28px', fontWeight: 800 }}>
            {users.reduce((sum, u) => sum + u.gold, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#ff6b35',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>👥</span> ALL USERS
        </h3>
        {users.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            background: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #3a3a3a',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>👥</div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
              No users found
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {users.map((user) => {
              const isExpanded = expandedUsers.has(user.id)
              const isCurrentUser = user.id === userId
              
              return (
                <div key={user.id}>
                  {/* User Card */}
                  <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px',
                  background: user.is_admin
                    ? 'linear-gradient(135deg, #2a1a0a 0%, #3a2a1a 100%)'
                    : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                  border: `2px solid ${user.is_admin ? '#ffd700' : '#3a3a3a'}`,
                  borderRadius: '14px',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                }}
                    onClick={() => toggleExpand(user.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                  <img
                    src={getAvatarImage(user.avatar_level)}
                    alt={`${getDisplayName(user)} avatar`}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      border: `2px solid ${user.is_admin ? '#ffd700' : '#3a3a3a'}`
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: '#fff',
                        letterSpacing: '-0.5px'
                      }}>
                        {getDisplayName(user).toUpperCase()}
                        {user.display_name && (
                          <span style={{
                            fontSize: '12px',
                            color: '#888',
                            fontWeight: 500,
                            marginLeft: '8px',
                            fontStyle: 'italic'
                          }}>
                            ({user.username})
                          </span>
                        )}
                      </div>
                      {user.is_admin && (
                        <span style={{
                          padding: '4px 10px',
                          background: 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                          color: '#000',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.5px'
                        }}>
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '20px',
                      fontSize: '13px',
                      color: '#888',
                      fontWeight: 600
                    }}>
                      <span>Level: <span style={{ color: '#ff6b35' }}>{user.avatar_level}/10</span></span>
                      <span>EXP: <span style={{ color: '#4caf50' }}>{user.lifetime_exp}</span></span>
                      <span>Gold: <span style={{ color: '#ffd700' }}>💰 {user.gold}</span></span>
                    </div>
                  </div>
                </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#888', fontSize: '12px' }}>
                        {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Edit'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Controls */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '12px',
                      padding: '25px',
                      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                      border: '1px solid #3a3a3a',
                      borderRadius: '14px'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px',
                        marginBottom: '20px'
                      }}>
                        {/* Edit Gold */}
                        <div>
                          <label style={{ display: 'block', color: '#ffd700', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                            💰 GOLD
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="number"
                              value={editValues[user.id]?.gold || user.gold}
                              onChange={(e) => updateEditValue(user.id, 'gold', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                background: '#1a1a1a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px'
                              }}
                              min="0"
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateGold(user.id); }}
                              disabled={actionLoading}
                              style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              Update
                            </button>
                          </div>
                        </div>

                        {/* Edit EXP */}
                        <div>
                          <label style={{ display: 'block', color: '#4caf50', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                            ⭐ EXP
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="number"
                              value={editValues[user.id]?.exp || user.lifetime_exp}
                              onChange={(e) => updateEditValue(user.id, 'exp', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                background: '#1a1a1a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px'
                              }}
                              min="0"
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateExp(user.id); }}
                              disabled={actionLoading}
                              style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              Update
                            </button>
                          </div>
                        </div>

                        {/* Edit Level */}
                        <div>
                          <label style={{ display: 'block', color: '#ff6b35', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                            📈 LEVEL
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="number"
                              value={editValues[user.id]?.level || user.avatar_level}
                              onChange={(e) => updateEditValue(user.id, 'level', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                background: '#1a1a1a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px'
                              }}
                              min="0"
                              max="10"
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateLevel(user.id); }}
                              disabled={actionLoading}
                              style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              Update
                            </button>
                          </div>
                        </div>

                        {/* Edit Username */}
                        <div>
                          <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                            👤 USERNAME
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={editValues[user.id]?.username || user.username}
                              onChange={(e) => updateEditValue(user.id, 'username', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                background: '#1a1a1a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px'
                              }}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateUsername(user.id); }}
                              disabled={actionLoading}
                              style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '12px',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #3a3a3a'
                      }}>
                  {!user.is_admin ? (
                    <button
                            onClick={(e) => { e.stopPropagation(); handlePromote(user.id); }}
                            disabled={actionLoading || isCurrentUser}
                      style={{
                              padding: '12px 20px',
                              background: isCurrentUser
                          ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                          : 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                              color: isCurrentUser ? '#888' : '#000',
                        border: 'none',
                        borderRadius: '10px',
                              cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                              fontSize: '13px'
                            }}
                          >
                            ⭐ Promote to Admin
                    </button>
                  ) : (
                    <button
                            onClick={(e) => { e.stopPropagation(); handleDemote(user.id); }}
                            disabled={actionLoading || isCurrentUser}
                      style={{
                              padding: '12px 20px',
                              background: isCurrentUser
                          ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                          : 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                              cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              fontSize: '13px'
                            }}
                          >
                            ⬇️ Demote from Admin
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTasks(user.id); }}
                          disabled={actionLoading}
                          style={{
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          🗑️ Delete Tasks
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResetUser(user.id); }}
                          disabled={actionLoading}
                          style={{
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          🔄 Reset User Data
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }}
                          disabled={actionLoading || isCurrentUser}
                          style={{
                            padding: '12px 20px',
                            background: isCurrentUser
                              ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                              : 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          ⚠️ Delete User
                    </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
