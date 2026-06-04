'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  listStealTargetInventory,
  attemptItemSteal,
  getItemStealCooldown,
  getItemStealNotifications,
  markItemStealNotificationRead,
  clearItemStealNotifications,
  type ItemStealNotification,
  type StealTargetItem,
  type ItemStealCooldown,
} from '@/lib/itemSteal'
import { getDailyLeaderboard } from '@/lib/leaderboard'
import { getDisplayName } from '@/lib/supabase'
import { showModal, showConfirm } from '@/lib/modal'
import type { Profile, ShopItem, UserInventory } from '@/lib/supabase'

interface ItemStealPanelProps {
  userId: string
  stealInventory: (UserInventory & { item: ShopItem }) | null
  userGold: number
  onChange: () => void
}

const STEAL_ODDS = 50

export default function ItemStealPanel({ userId, stealInventory, userGold, onChange }: ItemStealPanelProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [notifications, setNotifications] = useState<ItemStealNotification[]>([])
  const [cooldown, setCooldown] = useState<ItemStealCooldown>({ onCooldown: false, nextAvailable: null })
  const [modalOpen, setModalOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [targetItems, setTargetItems] = useState<StealTargetItem[]>([])
  const [targetItemsLoading, setTargetItemsLoading] = useState(false)
  const [selectedInvId, setSelectedInvId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())
  const mountedRef = useRef(true)

  const reload = useCallback(async () => {
    const [usersRes, notifRes, cdRes] = await Promise.allSettled([
      getDailyLeaderboard(),
      getItemStealNotifications(userId),
      getItemStealCooldown(userId),
    ])
    if (!mountedRef.current) return

    if (usersRes.status === 'fulfilled') setUsers(usersRes.value.filter((u) => u.id !== userId))
    else console.error('getDailyLeaderboard failed:', usersRes.reason)

    if (notifRes.status === 'fulfilled') setNotifications(notifRes.value)
    else console.error('getItemStealNotifications failed:', notifRes.reason)

    if (cdRes.status === 'fulfilled') setCooldown(cdRes.value)
    else console.error('getItemStealCooldown failed:', cdRes.reason)
  }, [userId])

  useEffect(() => {
    mountedRef.current = true
    reload()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(reload, 30000)
    return () => {
      mountedRef.current = false
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [reload])

  // Load the target's stealable items whenever the chosen target changes.
  useEffect(() => {
    if (!modalOpen || !target) {
      setTargetItems([])
      setSelectedInvId('')
      return
    }
    let cancelled = false
    setTargetItemsLoading(true)
    setSelectedInvId('')
    listStealTargetInventory(target)
      .then((items) => { if (!cancelled) setTargetItems(items) })
      .catch((err) => { if (!cancelled) { console.error(err); setTargetItems([]) } })
      .finally(() => { if (!cancelled) setTargetItemsLoading(false) })
    return () => { cancelled = true }
  }, [modalOpen, target])

  const selectedItem = targetItems.find((i) => i.inventory_id === selectedInvId) || null
  const worth = selectedItem?.cost ?? 0
  const canAfford = userGold >= worth
  const cooldownSec = cooldown.onCooldown && cooldown.nextAvailable
    ? Math.max(0, Math.floor((new Date(cooldown.nextAvailable).getTime() - now) / 1000))
    : 0
  const onCooldown = cooldownSec > 0

  const fmtCooldown = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }

  const openModal = () => {
    setTarget('')
    setTargetItems([])
    setSelectedInvId('')
    setModalOpen(true)
  }

  const handleSteal = async () => {
    if (!stealInventory || !target || !selectedItem) return
    if (!canAfford) {
      await showModal('Not enough gold', `You need at least ${worth} gold to risk stealing this item.`, 'warning')
      return
    }
    const targetUser = users.find((u) => u.id === target)
    const ok = await showConfirm(
      'Attempt steal',
      `Try to steal ${selectedItem.name} from ${targetUser ? getDisplayName(targetUser) : 'this user'}? ` +
      `${STEAL_ODDS}% chance to succeed. If you fail you pay them ${worth} gold.`,
    )
    if (!ok) return

    setSubmitting(true)
    try {
      const result = await attemptItemSteal(userId, stealInventory.id, selectedItem.inventory_id)
      setModalOpen(false)
      await reload()
      onChange()
      if (result.success) {
        await showModal('Steal succeeded! 🥷', `You stole ${result.item_name} from ${result.target_name}!`, 'success')
      } else {
        await showModal('Steal failed', `You couldn't grab ${result.item_name}. You paid ${result.target_name} ${result.worth} gold.`, 'error')
      }
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to attempt steal', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await markItemStealNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearAll = async () => {
    try {
      await clearItemStealNotifications(userId)
      setNotifications([])
    } catch (err) {
      console.error(err)
    }
  }

  const unreadResults = notifications.filter((n) => !n.is_read)
  const hasAnyContent = !!stealInventory || unreadResults.length > 0
  if (!hasAnyContent) return null

  return (
    <div style={{
      marginBottom: 30,
      background: 'linear-gradient(135deg, #102a26 0%, #0a0a0a 100%)',
      border: '2px solid #1abc9c',
      borderRadius: 16,
      padding: 20,
      boxShadow: '0 8px 30px rgba(26, 188, 156, 0.25)',
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: 18,
        fontWeight: 800,
        color: '#1abc9c',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>🥷 ITEM STEAL</h3>

      {stealInventory && (
        <div style={{
          padding: 14,
          background: 'rgba(26, 188, 156, 0.1)',
          border: '1px solid rgba(26, 188, 156, 0.4)',
          borderRadius: 10,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            You have <span style={{ color: '#ffd700' }}>{stealInventory.quantity}</span> item steal{stealInventory.quantity > 1 ? 's' : ''} ready.
            {onCooldown && (
              <span style={{ color: '#ff6b35', marginLeft: 8 }}>
                Next attempt in {fmtCooldown(cooldownSec)}.
              </span>
            )}
          </div>
          <button
            onClick={openModal}
            disabled={onCooldown}
            style={{
              padding: '10px 20px',
              background: onCooldown ? '#3a3a3a' : 'linear-gradient(135deg, #1abc9c 0%, #0e7d68 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: onCooldown ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >🥷 STEAL AN ITEM</button>
        </div>
      )}

      {unreadResults.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ color: '#1abc9c', fontWeight: 700, fontSize: 13 }}>📜 Recent results</div>
            <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer' }}>clear all</button>
          </div>
          {unreadResults.map((n) => {
            const positive = n.gold_delta > 0
            const negative = n.gold_delta < 0
            return (
              <div key={n.id} style={{
                padding: 10,
                background: '#0a0a0a',
                border: `1px solid ${positive ? '#4caf50' : negative ? '#ff4444' : '#1abc9c'}`,
                borderRadius: 8,
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <div style={{ color: '#fff', fontSize: 12 }}>
                  {n.message}
                  {n.gold_delta !== 0 && (
                    <span style={{ marginLeft: 8, color: positive ? '#4caf50' : '#ff4444', fontWeight: 800 }}>
                      {positive ? '+' : ''}{n.gold_delta}g
                    </span>
                  )}
                </div>
                <button onClick={() => handleDismiss(n.id)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer' }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && stealInventory && (
        <div
          onClick={() => !submitting && setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#141414',
              border: '2px solid #1abc9c',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#1abc9c', fontSize: 22, fontWeight: 800 }}>🥷 Steal an Item</h3>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ color: '#ccc', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>TARGET</div>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0a0a',
                  border: '1px solid #1abc9c',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                <option value="">Select target...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{getDisplayName(u)}</option>
                ))}
              </select>
            </label>

            {target && (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={{ color: '#ccc', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>ITEM TO STEAL</div>
                {targetItemsLoading ? (
                  <div style={{ color: '#888', fontSize: 13, padding: '8px 0' }}>Loading their items…</div>
                ) : targetItems.length === 0 ? (
                  <div style={{ color: '#888', fontSize: 13, padding: '8px 0' }}>This player has no items to steal.</div>
                ) : (
                  <select
                    value={selectedInvId}
                    onChange={(e) => setSelectedInvId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#0a0a0a',
                      border: '1px solid #1abc9c',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    <option value="">Select an item...</option>
                    {targetItems.map((i) => (
                      <option key={i.inventory_id} value={i.inventory_id}>
                        {i.name} — worth {i.cost}g{i.quantity > 1 ? ` (x${i.quantity})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            <div style={{
              padding: 12,
              background: 'rgba(26, 188, 156, 0.1)',
              border: '1px solid rgba(26, 188, 156, 0.4)',
              borderRadius: 8,
              marginBottom: 16,
              color: '#fff',
              fontSize: 13,
            }}>
              <div>Success chance: <strong style={{ color: '#1abc9c' }}>{STEAL_ODDS}%</strong></div>
              <div>On success: <strong style={{ color: '#4caf50' }}>{selectedItem ? selectedItem.name : 'the item'}</strong> moves to your inventory</div>
              <div>On failure: you pay <strong style={{ color: '#ff4444' }}>{worth}g</strong> to the target</div>
              {selectedItem && !canAfford && (
                <div style={{ marginTop: 8, color: '#ff4444', fontWeight: 700 }}>
                  You need {worth}g to risk this — you have {userGold}g.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSteal}
                disabled={submitting || !target || !selectedItem || !canAfford}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (!target || !selectedItem || !canAfford) ? '#3a3a3a' : 'linear-gradient(135deg, #1abc9c 0%, #0e7d68 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: (submitting || !target || !selectedItem || !canAfford) ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >{submitting ? 'Stealing...' : '🥷 ATTEMPT STEAL'}</button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                style={{
                  padding: '12px 20px',
                  background: '#3a3a3a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
