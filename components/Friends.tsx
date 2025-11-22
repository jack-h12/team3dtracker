/**
 * Friends Component
 * 
 * Manages friend requests:
 * - Shows pending requests (sent and received)
 * - Allows sending friend requests to other users
 * - Allows accepting or rejecting received requests
 * - Shows list of friends
 * 
 * Communicates with Supabase friend_requests table:
 * - Sends requests using sendFriendRequest()
 * - Accepts/rejects using acceptFriendRequest() and rejectFriendRequest()
 * - Reads requests using getFriendRequests() and getFriends()
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { sendFriendRequest, getFriendRequests, acceptFriendRequest, rejectFriendRequest, getFriends, getUserProfile } from '@/lib/friends'
import { getDailyLeaderboard } from '@/lib/leaderboard'
import { getDisplayName, supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/supabase-helpers'
import { showModal } from '@/lib/modal'
import { getAvatarImage } from '@/lib/utils'
import type { FriendRequest, Profile } from '@/lib/supabase'

interface FriendsProps {
  userId: string
}

export default function Friends({ userId }: FriendsProps) {
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<FriendRequest[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const mountedRef = useRef(true)
  const hasInitialDataRef = useRef(false)

  const loadData = useCallback(async (silent: boolean = false) => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      console.log('Friends: Already loading, skipping duplicate call')
      return
    }

    if (!mountedRef.current) return

    isLoadingRef.current = true
    // Only show loading UI if we haven't loaded initial data yet and not silent
    if (!silent && !hasInitialDataRef.current) {
      setLoading(true)
    }
    try {
      const [reqs, frs, users] = await Promise.all([
        withRetry(() => getFriendRequests(userId), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => getFriends(userId), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => getDailyLeaderboard(), { maxRetries: 3, timeout: 15000 }),
      ])
      
      if (mountedRef.current) {
        setRequests(reqs.filter(r => r.status === 'pending'))
        setFriends(frs)
        setAllUsers(users.filter(u => u.id !== userId))
        // Mark that we've loaded initial data
        hasInitialDataRef.current = true
      }
    } catch (err) {
      console.error('Error loading friends data:', err)
    } finally {
      isLoadingRef.current = false
      if (mountedRef.current) {
        // Only clear loading state if we were showing it (not silent refresh)
        if (!silent) {
          setLoading(false)
        }
      }
    }
  }, [userId])

  useEffect(() => {
    mountedRef.current = true
    isLoadingRef.current = false

    // Run on mount - fetch data when component first loads
    loadData()

    // Run whenever the tab becomes active again
    // Silently refresh data in background without clearing UI
    const handler = () => {
      // Only reload if tab is visible (not hidden) and not already loading
      if (!document.hidden && mountedRef.current && !isLoadingRef.current) {
        console.log('Friends: Tab became visible, silently refreshing data...')
        // Reset loading flag to allow fresh load
        isLoadingRef.current = false
        // Wait a moment for browser to be ready
        setTimeout(() => {
          if (!document.hidden && mountedRef.current && !isLoadingRef.current) {
            // Pass silent=true to refresh without showing loading state
            loadData(true)
          }
        }, 500)
      }
    }

    // Listen for visibility changes (when user switches tabs)
    document.addEventListener("visibilitychange", handler)

    return () => {
      mountedRef.current = false
      document.removeEventListener("visibilitychange", handler)
      isLoadingRef.current = false
    }
  }, [loadData])

  const handleSendRequest = useCallback(async () => {
    if (!selectedUserId || loading) return

    setLoading(true)
    try {
      await sendFriendRequest(userId, selectedUserId)
      await loadData()
      setSelectedUserId('')
      await showModal('Success', 'Friend request sent!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to send friend request', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, userId, loading, loadData])

  const handleAccept = useCallback(async (requestId: string) => {
    if (loading) return
    
    setLoading(true)
    try {
      await acceptFriendRequest(requestId)
      await loadData()
    } catch (err) {
      console.error('Error accepting request:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, loadData])

  const handleReject = useCallback(async (requestId: string) => {
    if (loading) return
    
    setLoading(true)
    try {
      await rejectFriendRequest(requestId)
      await loadData()
    } catch (err) {
      console.error('Error rejecting request:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, loadData])


  const receivedRequests = requests.filter(r => r.receiver_id === userId)
  const sentRequests = requests.filter(r => r.sender_id === userId)

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>FRIENDS</h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          Connect with others • Build your squad
        </p>
      </div>

      {/* Send Friend Request */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1a2e 0%, #16213e 100%)',
        border: '1px solid #00d4ff',
        borderRadius: '16px',
        padding: '25px',
        marginBottom: '30px',
        boxShadow: '0 8px 30px rgba(0, 212, 255, 0.2)'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#00d4ff'
        }}>SEND FRIEND REQUEST</h3>
        <div style={{ display: 'flex', gap: '12px' }} className="responsive-flex">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: '#0a0a0a',
              border: '1px solid #00d4ff',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="">Select a user...</option>
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {getDisplayName(user)}
              </option>
            ))}
          </select>
          <button
            onClick={handleSendRequest}
            disabled={!selectedUserId || loading}
            style={{
              padding: '14px 28px',
              background: !selectedUserId || loading
                ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                : 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: !selectedUserId || loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              transition: 'all 0.3s ease',
              boxShadow: !selectedUserId || loading
                ? 'none'
                : '0 4px 15px rgba(0, 212, 255, 0.4)'
            }}
            onMouseEnter={(e) => {
              if (selectedUserId && !loading) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 212, 255, 0.5)'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedUserId && !loading) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.4)'
              }
            }}
          >
            SEND
          </button>
        </div>
      </div>

      {/* Received Requests */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#00d4ff',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>📥</span> RECEIVED REQUESTS
          <span style={{
            background: 'rgba(0, 212, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600
          }}>{receivedRequests.length}</span>
        </h3>
        {receivedRequests.length === 0 ? (
          <div style={{
            padding: '40px',
            background: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #3a3a3a',
            textAlign: 'center',
            color: '#888'
          }}>
            No pending requests
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {receivedRequests.map((req) => {
              const sender = allUsers.find(u => u.id === req.sender_id)
              return (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, #0a1a2e 0%, #16213e 100%)',
                    border: '1px solid #00d4ff',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {sender && (
                      <img
                        src={getAvatarImage(sender.avatar_level)}
                        alt={`${getDisplayName(sender)} avatar`}
                        style={{
                          width: '50px',
                          height: '50px',
                          objectFit: 'cover',
                          borderRadius: '10px',
                          border: '2px solid #00d4ff'
                        }}
                      />
                    )}
                    <div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '4px'
                      }}>
                        {sender ? getDisplayName(sender).toUpperCase() : 'Unknown'}
                        {sender?.display_name && (
                          <span style={{
                            fontSize: '11px',
                            color: '#888',
                            fontWeight: 500,
                            marginLeft: '6px',
                            fontStyle: 'italic'
                          }}>
                            ({sender.username})
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#00d4ff',
                        fontWeight: 600
                      }}>
                        Level {sender?.avatar_level || 0}/10
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(0, 255, 136, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.3)'
                        }
                      }}
                    >
                      ✓ ACCEPT
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(255, 68, 68, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 68, 68, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 68, 68, 0.3)'
                        }
                      }}
                    >
                      ✕ REJECT
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sent Requests */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#00d4ff',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>📤</span> SENT REQUESTS
          <span style={{
            background: 'rgba(0, 212, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600
          }}>{sentRequests.length}</span>
        </h3>
        {sentRequests.length === 0 ? (
          <div style={{
            padding: '40px',
            background: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #3a3a3a',
            textAlign: 'center',
            color: '#888'
          }}>
            No sent requests
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sentRequests.map((req) => {
              const receiver = allUsers.find(u => u.id === req.receiver_id)
              return (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                    border: '1px solid #3a3a3a',
                    borderRadius: '12px'
                  }}
                >
                  {receiver && (
                    <img
                      src={getAvatarImage(receiver.avatar_level)}
                      alt={`${getDisplayName(receiver)} avatar`}
                      style={{
                        width: '50px',
                        height: '50px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        border: '2px solid #3a3a3a'
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: '4px'
                    }}>
                      {receiver ? getDisplayName(receiver).toUpperCase() : 'Unknown'}
                      {receiver?.display_name && (
                        <span style={{
                          fontSize: '11px',
                          color: '#888',
                          fontWeight: 500,
                          marginLeft: '6px',
                          fontStyle: 'italic'
                        }}>
                          ({receiver.username})
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                      fontWeight: 600
                    }}>
                      Pending...
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 14px',
                    background: 'rgba(255, 193, 7, 0.2)',
                    border: '1px solid rgba(255, 193, 7, 0.4)',
                    borderRadius: '8px',
                    color: '#ffc107',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    PENDING
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#00d4ff',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>👥</span> YOUR SQUAD
          <span style={{
            background: 'rgba(0, 212, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600
          }}>{friends.length}</span>
        </h3>
        {friends.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            background: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #3a3a3a',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>👥</div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
              No friends yet. Send some requests!
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {friends.map((req) => {
              const friendId = req.sender_id === userId ? req.receiver_id : req.sender_id
              const friend = allUsers.find(u => u.id === friendId)
              return (
                <div
                  key={req.id}
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #0a1a2e 0%, #16213e 100%)',
                    border: '2px solid #00d4ff',
                    borderRadius: '16px',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 30px rgba(0, 212, 255, 0.2)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 212, 255, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 212, 255, 0.2)'
                  }}
                >
                  {friend && (
                    <>
                      <img
                        src={getAvatarImage(friend.avatar_level)}
                        alt={`${getDisplayName(friend)} avatar`}
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '3px solid #00d4ff',
                          marginBottom: '15px',
                          boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)'
                        }}
                      />
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '8px'
                      }}>
                        {getDisplayName(friend).toUpperCase()}
                        {friend.display_name && (
                          <span style={{
                            fontSize: '12px',
                            color: '#888',
                            fontWeight: 500,
                            marginLeft: '8px',
                            fontStyle: 'italic'
                          }}>
                            ({friend.username})
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#00d4ff',
                        fontWeight: 600
                      }}>
                        Level {friend.avatar_level}/10 • {friend.lifetime_exp} EXP
                      </div>
                    </>
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

