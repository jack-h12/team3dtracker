'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getNotifications, getUnreadCount, markAllRead, clearAllNotifications } from '@/lib/notifications'
import type { AttackNotification } from '@/lib/notifications'
import {
  getBankrobNotifications,
  getBankrobUnreadCount,
  markAllBankrobRead,
  clearBankrobNotifications,
} from '@/lib/bankrob'
import type { BankrobNotification } from '@/lib/bankrob'
import {
  getItemStealNotifications,
  getItemStealUnreadCount,
  markAllItemStealRead,
  clearItemStealNotifications,
} from '@/lib/itemSteal'
import type { ItemStealNotification } from '@/lib/itemSteal'

interface InboxProps {
  userId: string
}

type InboxItem =
  | { kind: 'attack'; created_at: string; is_read: boolean; data: AttackNotification }
  | { kind: 'bankrob'; created_at: string; is_read: boolean; data: BankrobNotification }
  | { kind: 'item_steal'; created_at: string; is_read: boolean; data: ItemStealNotification }

export default function Inbox({ userId }: InboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AttackNotification[]>([])
  const [bankrobNotifs, setBankrobNotifs] = useState<BankrobNotification[]>([])
  const [itemStealNotifs, setItemStealNotifs] = useState<ItemStealNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadUnreadCount = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        getUnreadCount(userId).catch(() => 0),
        getBankrobUnreadCount(userId).catch(() => 0),
        getItemStealUnreadCount(userId).catch(() => 0),
      ])
      setUnreadCount(a + b + c)
    } catch (err) {
      console.error('Error loading unread count:', err)
    }
  }, [userId])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b, c] = await Promise.all([
        getNotifications(userId).catch(() => []),
        getBankrobNotifications(userId).catch(() => []),
        getItemStealNotifications(userId).catch(() => []),
      ])
      setNotifications(a)
      setBankrobNotifs(b)
      setItemStealNotifs(c)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const items: InboxItem[] = [
    ...notifications.map((n) => ({ kind: 'attack' as const, created_at: n.created_at, is_read: n.is_read, data: n })),
    ...bankrobNotifs
      // Hide invite_received (BankrobPanel shows those with action buttons)
      // and the planner's own result notifications — the planner already sees
      // their result via the BankrobAnimation and the Recent Results section.
      .filter((n) => n.kind !== 'invite_received' && n.kind !== 'planner_won' && n.kind !== 'planner_lost')
      .map((n) => ({ kind: 'bankrob' as const, created_at: n.created_at, is_read: n.is_read, data: n })),
    ...itemStealNotifs
      // Hide the thief's own results — they see those in the Item Steal panel/modal.
      .filter((n) => n.kind !== 'steal_won' && n.kind !== 'steal_lost')
      .map((n) => ({ kind: 'item_steal' as const, created_at: n.created_at, is_read: n.is_read, data: n })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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
      await Promise.all([
        markAllRead(userId).catch(() => null),
        markAllBankrobRead(userId).catch(() => null),
        markAllItemStealRead(userId).catch(() => null),
      ])
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setBankrobNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setItemStealNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all read:', err)
    }
  }

  const handleClearAll = async () => {
    try {
      await Promise.all([
        clearAllNotifications(userId).catch(() => null),
        clearBankrobNotifications(userId).catch(() => null),
        clearItemStealNotifications(userId).catch(() => null),
      ])
      setNotifications([])
      setBankrobNotifs([])
      setItemStealNotifs([])
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
            }}>INBOX</span>
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
              {items.length > 0 && (
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
            {loading && items.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#888',
                fontSize: '14px',
              }}>
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#128238;</div>
                <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>
                  Nothing here yet.
                </p>
              </div>
            ) : (
              items.map((item) => {
                if (item.kind === 'attack') {
                  const notif = item.data
                  return (
                    <div
                      key={`a-${notif.id}`}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: notif.is_read ? 'transparent' : 'rgba(255, 68, 68, 0.05)',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1, marginTop: '2px' }}>
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
                            <span style={{ color: '#ff6b35', fontWeight: 800 }}>{notif.attacker_username}</span>
                            {' attacked you with '}
                            <span style={{ color: '#ff4444', fontWeight: 700 }}>{notif.weapon_name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: notif.damage_dealt > 0 ? '#ff4444' : '#4caf50' }}>
                              {notif.damage_dealt > 0 ? `-${notif.damage_dealt} EXP` : 'Blocked!'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#666', fontWeight: 500, flexShrink: 0 }}>
                              {formatTime(notif.created_at)}
                            </span>
                          </div>
                        </div>
                        {!notif.is_read && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff6b35', flexShrink: 0, marginTop: '6px' }} />
                        )}
                      </div>
                    </div>
                  )
                }

                if (item.kind === 'item_steal') {
                  const s = item.data
                  const sPositive = s.gold_delta > 0
                  const sNegative = s.gold_delta < 0
                  const sAccent = sPositive ? '#4caf50' : sNegative ? '#ff4444' : '#1abc9c'
                  return (
                    <div
                      key={`is-${s.id}`}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: s.is_read ? 'transparent' : 'rgba(26, 188, 156, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1, marginTop: '2px' }}>{'\uD83E\uDD77'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            color: '#fff',
                            fontWeight: s.is_read ? 500 : 700,
                            lineHeight: 1.4,
                            marginBottom: '4px',
                          }}>
                            {s.message}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {s.gold_delta !== 0 ? (
                              <span style={{ fontSize: '13px', fontWeight: 800, color: sAccent }}>
                                {sPositive ? '+' : ''}{s.gold_delta}g
                              </span>
                            ) : <span />}
                            <span style={{ fontSize: '11px', color: '#666', fontWeight: 500, flexShrink: 0 }}>
                              {formatTime(s.created_at)}
                            </span>
                          </div>
                        </div>
                        {!s.is_read && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1abc9c', flexShrink: 0, marginTop: '6px' }} />
                        )}
                      </div>
                    </div>
                  )
                }

                // bankrob result row
                const n = item.data
                const positive = n.gold_delta > 0
                const negative = n.gold_delta < 0
                const icon = n.kind === 'heist_won' || n.kind === 'heist_lost' ? '\uD83C\uDFAD' : '\uD83D\uDCB0'
                const accent = positive ? '#4caf50' : negative ? '#ff4444' : '#9b59b6'
                return (
                  <div
                    key={`b-${n.id}`}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: n.is_read ? 'transparent' : 'rgba(155, 89, 182, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1, marginTop: '2px' }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          color: '#fff',
                          fontWeight: n.is_read ? 500 : 700,
                          lineHeight: 1.4,
                          marginBottom: '4px',
                        }}>
                          {n.message}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {n.gold_delta !== 0 ? (
                            <span style={{ fontSize: '13px', fontWeight: 800, color: accent }}>
                              {positive ? '+' : ''}{n.gold_delta}g
                            </span>
                          ) : <span />}
                          <span style={{ fontSize: '11px', color: '#666', fontWeight: 500, flexShrink: 0 }}>
                            {formatTime(n.created_at)}
                          </span>
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9b59b6', flexShrink: 0, marginTop: '6px' }} />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
