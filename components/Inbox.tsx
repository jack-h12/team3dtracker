'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getNotifications, getUnreadCount, markAllRead, clearAllNotifications } from '@/lib/notifications'
import type { AttackNotification } from '@/lib/notifications'

interface InboxProps {
  userId: string
}

export default function Inbox({ userId }: InboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AttackNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount(userId)
      setUnreadCount(count)
    } catch (err) {
      console.error('Error loading unread count:', err)
    }
  }, [userId])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications(userId)
      setNotifications(data)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Poll unread count every 30 seconds
  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  // Load full notifications when opened
  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen, loadNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(!isOpen)
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead(userId)
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all read:', err)
    }
  }

  const handleClearAll = async () => {
    try {
      await clearAllNotifications(userId)
      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      console.error('Error clearing notifications:', err)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHrs < 24) return `${diffHrs}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Mail Icon Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative',
          padding: '8px',
          background: isOpen
            ? 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
            : 'transparent',
          border: '1px solid #3a3a3a',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#ff6b35'
          e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#3a3a3a'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {/* Mail SVG Icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={unreadCount > 0 ? '#ff6b35' : '#999'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-10 7L2 7" />
        </svg>
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ff4444',
            color: '#fff',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '11px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #1a1a1a',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '340px',
          maxHeight: '420px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #222 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '14px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          zIndex: 2000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #3a3a3a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontWeight: 800,
              fontSize: '15px',
              color: '#fff',
              letterSpacing: '-0.3px',
            }}>ATTACK LOG</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(255, 107, 53, 0.15)',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '6px',
                    color: '#ff6b35',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(255, 68, 68, 0.1)',
                    border: '1px solid rgba(255, 68, 68, 0.3)',
                    borderRadius: '6px',
                    color: '#ff4444',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            maxHeight: '360px',
          }}>
            {loading && notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#888',
                fontSize: '14px',
              }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#9876;&#65039;</div>
                <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>
                  No attacks yet. You're safe... for now.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: notif.is_read ? 'transparent' : 'rgba(255, 68, 68, 0.05)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div style={{
                      fontSize: '24px',
                      flexShrink: 0,
                      lineHeight: 1,
                      marginTop: '2px',
                    }}>
                      {notif.damage_dealt > 0 ? '\u2694\uFE0F' : '\uD83D\uDEE1\uFE0F'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        color: '#fff',
                        fontWeight: notif.is_read ? 500 : 700,
                        lineHeight: 1.4,
                        marginBottom: '4px',
                      }}>
                        <span style={{ color: '#ff6b35', fontWeight: 800 }}>
                          {notif.attacker_username}
                        </span>
                        {' attacked you with '}
                        <span style={{ color: '#ff4444', fontWeight: 700 }}>
                          {notif.weapon_name}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: notif.damage_dealt > 0 ? '#ff4444' : '#4caf50',
                        }}>
                          {notif.damage_dealt > 0
                            ? `-${notif.damage_dealt} EXP`
                            : 'Blocked!'}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: '#666',
                          fontWeight: 500,
                          flexShrink: 0,
                        }}>
                          {formatTime(notif.created_at)}
                        </span>
                      </div>
                    </div>
                    {!notif.is_read && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ff6b35',
                        flexShrink: 0,
                        marginTop: '6px',
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
