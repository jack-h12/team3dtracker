/**
 * Admin Component
 * 
 * Admin panel for managing users:
 * - View all users
 * - Promote/demote users to/from admin
 * - View user stats
 * 
 * Only accessible to admin users.
 */

'use client'

import { useState, useEffect } from 'react'
import { isAdmin, promoteToAdmin, demoteFromAdmin, getAllUsers } from '@/lib/admin'
import { getDisplayName } from '@/lib/supabase'
import { showModal, showConfirm } from '@/lib/modal'
import type { Profile } from '@/lib/supabase'

interface AdminProps {
  userId: string
}

export default function Admin({ userId }: AdminProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  useEffect(() => {
    checkAdminAndLoad()
  }, [userId])

  const checkAdminAndLoad = async () => {
    setLoading(true)
    try {
      const adminStatus = await isAdmin(userId)
      setUserIsAdmin(adminStatus)
      
      if (adminStatus) {
        const allUsers = await getAllUsers()
        setUsers(allUsers)
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePromote = async (targetUserId: string) => {
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
  }

  const handleDemote = async (targetUserId: string) => {
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
  }

  // Get avatar image based on level (same as Avatar component)
  const getAvatarImage = (level: number): string => {
    if (level === 0) return '/smeagol-level1.webp'
    if (level === 1) return '/smeagol-level1.webp'
    if (level === 2) return '/babythanos-level2.jpg'
    if (level === 3) return '/boy thanos-level3.jpg'
    if (level === 4) return '/young thanos-level4.jpg'
    if (level === 5) return '/thanos one stone-level5.jpg'
    if (level === 6) return '/thanos two stones-level6.avif'
    if (level === 7) return '/thanos 3 stones-level7.jpg'
    if (level === 8) return '/thanos 4 stones-level8.jpg'
    if (level === 9) return '/thanos 5 stones-level9.jpg'
    return '/goku thanos-level10.webp'
  }

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
        }}>ADMIN PANEL</h2>
        <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>
          Manage users • Promote admins • View all accounts
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
            {users.map((user) => (
              <div
                key={user.id}
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
                  transition: 'all 0.3s ease'
                }}
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
                <div style={{ display: 'flex', gap: '10px' }}>
                  {!user.is_admin ? (
                    <button
                      onClick={() => handlePromote(user.id)}
                      disabled={actionLoading || user.id === userId}
                      style={{
                        padding: '10px 20px',
                        background: user.id === userId
                          ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                          : 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                        color: user.id === userId ? '#888' : '#000',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: user.id === userId ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        transition: 'all 0.3s ease',
                        boxShadow: user.id === userId ? 'none' : '0 4px 15px rgba(255, 215, 0, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        if (!actionLoading && user.id !== userId) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!actionLoading && user.id !== userId) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)'
                        }
                      }}
                    >
                      {user.id === userId ? 'YOU' : '⭐ PROMOTE'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDemote(user.id)}
                      disabled={actionLoading || user.id === userId}
                      style={{
                        padding: '10px 20px',
                        background: user.id === userId
                          ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                          : 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: user.id === userId ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        transition: 'all 0.3s ease',
                        boxShadow: user.id === userId ? 'none' : '0 4px 15px rgba(255, 68, 68, 0.4)'
                      }}
                      onMouseEnter={(e) => {
                        if (!actionLoading && user.id !== userId) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 68, 68, 0.5)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!actionLoading && user.id !== userId) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 68, 68, 0.4)'
                        }
                      }}
                    >
                      {user.id === userId ? 'YOU' : '⬇️ DEMOTE'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

