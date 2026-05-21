'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  planBankrob,
  respondToInvite,
  resolveMyExpiredBankrobs,
  getActiveAttemptAsPlanner,
  getPendingInvites,
  getBankrobNotifications,
  markBankrobNotificationRead,
  clearBankrobNotifications,
  getBankrobConfig,
  type BankrobNotification,
} from '@/lib/bankrob'
import { getDailyLeaderboard } from '@/lib/leaderboard'
import { getDisplayName, supabase } from '@/lib/supabase'
import { showModal, showConfirm } from '@/lib/modal'
import { getAvatarImage } from '@/lib/utils'
import BankrobAnimation from '@/components/BankrobAnimation'
import type { Profile, ShopItem, UserInventory } from '@/lib/supabase'

interface BankrobPanelProps {
  userId: string
  bankrobInventory: (UserInventory & { item: ShopItem }) | null
  onChange: () => void
}

type Crew = { id: string; label: string }

export default function BankrobPanel({ userId, bankrobInventory, onChange }: BankrobPanelProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [activeAttempt, setActiveAttempt] = useState<Awaited<ReturnType<typeof getActiveAttemptAsPlanner>>>(null)
  const [invites, setInvites] = useState<Awaited<ReturnType<typeof getPendingInvites>>>([])
  const [notifications, setNotifications] = useState<BankrobNotification[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [crew, setCrew] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())
  const [animation, setAnimation] = useState<{
    result: 'success' | 'failure'
    targetAvatar: string
    targetName: string
    goldAmount: number
  } | null>(null)
  const mountedRef = useRef(true)
  const seenResultIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

  const reload = useCallback(async () => {
    // Lazy-resolve any expired heists involving this user before fetching state.
    try { await resolveMyExpiredBankrobs() } catch (e) { console.error('resolveMyExpired failed:', e) }

    // Run each query independently so one failure doesn't blank the whole panel.
    const [activeRes, inviteRes, notifRes, allUsersRes] = await Promise.allSettled([
      getActiveAttemptAsPlanner(userId),
      getPendingInvites(userId),
      getBankrobNotifications(userId),
      getDailyLeaderboard(),
    ])

    if (!mountedRef.current) return

    if (activeRes.status === 'fulfilled') setActiveAttempt(activeRes.value)
    else console.error('getActiveAttempt failed:', activeRes.reason)

    if (inviteRes.status === 'fulfilled') setInvites(inviteRes.value)
    else console.error('getPendingInvites failed:', inviteRes.reason)

    if (notifRes.status === 'fulfilled') {
      const next = notifRes.value
      setNotifications(next)

      // Detect newly-arrived result notifications and trigger the animation
      // for the first one we haven't seen. On the very first render we seed
      // the seen-set silently so old results don't replay on every page load.
      const resultKinds = new Set(['heist_won', 'heist_lost', 'planner_won', 'planner_lost', 'target_robbed', 'target_paid'])
      if (firstLoadRef.current) {
        next.forEach((n) => seenResultIdsRef.current.add(n.id))
        firstLoadRef.current = false
      } else {
        const fresh = next.find((n) => resultKinds.has(n.kind) && !seenResultIdsRef.current.has(n.id))
        if (fresh) {
          // Mark every new notification seen so we don't loop
          next.forEach((n) => seenResultIdsRef.current.add(n.id))
          // Look up the relevant counterparty profile for the avatar/name
          const counterpartyIsTarget = fresh.kind === 'heist_won' || fresh.kind === 'heist_lost'
          ;(async () => {
            let counterpartyId: string | null = null
            try {
              const { data } = await supabase
                .from('bankrob_attempts')
                .select('planner_id, target_id')
                .eq('id', fresh.attempt_id as string)
                .single()
              const att = data as { planner_id: string; target_id: string } | null
              if (att) {
                counterpartyId = counterpartyIsTarget ? att.target_id : att.planner_id
              }
            } catch (e) {
              console.error('animation lookup failed', e)
            }
            let avatar = '/smeagol-level1.webp'
            let name = 'Unknown'
            if (counterpartyId) {
              try {
                const { data: p } = await supabase
                  .from('profiles')
                  .select('username, display_name, avatar_level')
                  .eq('id', counterpartyId)
                  .single()
                const prof = p as { username: string; display_name: string | null; avatar_level: number } | null
                if (prof) {
                  avatar = getAvatarImage(prof.avatar_level)
                  name = prof.display_name || prof.username
                }
              } catch (e) {
                console.error('profile lookup failed', e)
              }
            }
            const won = fresh.kind === 'heist_won' || fresh.kind === 'planner_won' || fresh.kind === 'target_paid'
            setAnimation({
              result: won ? 'success' : 'failure',
              targetAvatar: avatar,
              targetName: name,
              goldAmount: Math.abs(fresh.gold_delta),
            })
          })()
        }
      }
    } else {
      console.error('getBankrobNotifications failed:', notifRes.reason)
    }

    if (allUsersRes.status === 'fulfilled') {
      setUsers(allUsersRes.value.filter((u) => u.id !== userId))
    } else {
      console.error('getDailyLeaderboard failed:', allUsersRes.reason)
    }
  }, [userId])

  useEffect(() => {
    mountedRef.current = true
    reload()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(reload, 15000)
    return () => {
      mountedRef.current = false
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [reload])

  const config = bankrobInventory ? getBankrobConfig(bankrobInventory.item.effect) : { baseOdds: 50, crewBonus: 10, maxOdds: 60, lootPct: 0 }
  const MAX_CREW = 1
  const previewOdds = Math.min(config.maxOdds, config.baseOdds + Math.min(crew.length, MAX_CREW) * config.crewBonus)

  const crewOptions: Crew[] = users
    .filter((u) => u.id !== target)
    .map((u) => ({ id: u.id, label: getDisplayName(u) }))

  const handlePlan = async () => {
    if (!bankrobInventory) return
    if (!target) {
      await showModal('Select target', 'Pick a target before planning the heist.', 'warning')
      return
    }
    const targetUser = users.find((u) => u.id === target)
    const ok = await showConfirm(
      'Plan heist',
      `Target: ${targetUser ? getDisplayName(targetUser) : 'Unknown'}. Crew: ${crew.length}. Success chance: ${previewOdds}%. Continue?`,
    )
    if (!ok) return

    setSubmitting(true)
    try {
      const wasSolo = crew.length === 0
      await planBankrob(userId, target, bankrobInventory.id, crew)
      setModalOpen(false)
      setTarget('')
      setCrew([])
      await reload()
      onChange()
      if (!wasSolo) {
        await showModal(
          'Heist planned',
          'Invite sent. The heist auto-resolves in 5 minutes (or sooner if your crew accepts/declines).',
          'success',
        )
      }
      // Solo heists: skip the modal — BankrobAnimation will pop from the new result notification.
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to plan heist', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInvite = async (inviteId: string, accept: boolean) => {
    try {
      await respondToInvite(inviteId, accept)
      await reload()
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to respond to invite', 'error')
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await markBankrobNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearAll = async () => {
    try {
      await clearBankrobNotifications(userId)
      setNotifications([])
    } catch (err) {
      console.error(err)
    }
  }

  const expiresInSec = activeAttempt ? Math.max(0, Math.floor((new Date(activeAttempt.expires_at).getTime() - now) / 1000)) : 0

  const unreadResults = notifications.filter((n) => !n.is_read && n.kind !== 'invite_received')
  const hasAnyContent = !!bankrobInventory || !!activeAttempt || invites.length > 0 || unreadResults.length > 0

  if (!hasAnyContent) return null

  return (
    <div style={{
      marginBottom: 30,
      background: 'linear-gradient(135deg, #1a0f2e 0%, #0a0a0a 100%)',
      border: '2px solid #9b59b6',
      borderRadius: 16,
      padding: 20,
      boxShadow: '0 8px 30px rgba(155, 89, 182, 0.25)',
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: 18,
        fontWeight: 800,
        color: '#9b59b6',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>🎭 BANKROB</h3>

      {bankrobInventory && !activeAttempt && (
        <div style={{
          padding: 14,
          background: 'rgba(155, 89, 182, 0.1)',
          border: '1px solid rgba(155, 89, 182, 0.4)',
          borderRadius: 10,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            You have <span style={{ color: '#ffd700' }}>{bankrobInventory.quantity}</span> bankrob{bankrobInventory.quantity > 1 ? 's' : ''} ready.
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #9b59b6 0%, #6a1b9a 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >🎭 PLAN HEIST</button>
        </div>
      )}

      {activeAttempt && (
        <div style={{
          padding: 14,
          background: 'rgba(255, 107, 53, 0.1)',
          border: '1px solid rgba(255, 107, 53, 0.5)',
          borderRadius: 10,
          marginBottom: 12,
        }}>
          <div style={{ color: '#ff6b35', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            ⏰ Heist in progress — resolves in {Math.floor(expiresInSec / 60)}:{String(expiresInSec % 60).padStart(2, '0')}
          </div>
          <div style={{ color: '#ccc', fontSize: 12 }}>
            Crew responses: {activeAttempt.invites.filter((i) => i.status === 'accepted').length} accepted /
            {' '}{activeAttempt.invites.filter((i) => i.status === 'declined').length} declined /
            {' '}{activeAttempt.invites.filter((i) => i.status === 'pending').length} pending
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#9b59b6', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📨 Heist invites</div>
          {invites.map((inv) => {
            const planner = inv.planner_display_name || inv.planner_username
            const target = inv.target_display_name || inv.target_username
            return (
              <div key={inv.id} style={{
                padding: 12,
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: 8,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div style={{ color: '#fff', fontSize: 13 }}>
                  <strong style={{ color: '#9b59b6' }}>{planner}</strong> wants to rob <strong style={{ color: '#ff6b35' }}>{target}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleInvite(inv.id, true)} style={{ padding: '6px 14px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>JOIN</button>
                  <button onClick={() => handleInvite(inv.id, false)} style={{ padding: '6px 14px', background: '#3a3a3a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>DECLINE</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {unreadResults.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ color: '#9b59b6', fontWeight: 700, fontSize: 13 }}>📜 Recent results</div>
            <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer' }}>clear all</button>
          </div>
          {unreadResults.map((n) => {
            const positive = n.gold_delta > 0
            const negative = n.gold_delta < 0
            return (
              <div key={n.id} style={{
                padding: 10,
                background: '#0a0a0a',
                border: `1px solid ${positive ? '#4caf50' : negative ? '#ff4444' : '#3a3a3a'}`,
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

      {animation && (
        <BankrobAnimation
          isOpen={true}
          result={animation.result}
          targetAvatar={animation.targetAvatar}
          targetName={animation.targetName}
          goldAmount={animation.goldAmount}
          onComplete={() => setAnimation(null)}
        />
      )}

      {modalOpen && bankrobInventory && (
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
              border: '2px solid #9b59b6',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#9b59b6', fontSize: 22, fontWeight: 800 }}>🎭 Plan Heist</h3>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ color: '#ccc', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>TARGET</div>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setCrew((c) => c.filter((id) => id !== e.target.value))
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0a0a',
                  border: '1px solid #9b59b6',
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

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#ccc', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                CREW (optional, max {MAX_CREW}) — adds +{config.crewBonus}% success
              </div>
              <select
                value={crew[0] ?? ''}
                onChange={(e) => setCrew(e.target.value ? [e.target.value] : [])}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0a0a',
                  border: '1px solid #9b59b6',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                <option value="">No crew (solo)</option>
                {crewOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={{
              padding: 12,
              background: 'rgba(155, 89, 182, 0.1)',
              border: '1px solid rgba(155, 89, 182, 0.4)',
              borderRadius: 8,
              marginBottom: 16,
              color: '#fff',
              fontSize: 13,
            }}>
              <div>Success chance: <strong style={{ color: '#9b59b6' }}>{previewOdds}%</strong></div>
              <div>On success: steal a random amount — <strong style={{ color: '#ffd700' }}>min 100g</strong>, up to whatever's in their wallet (split evenly with crew)</div>
              <div>On failure: pay a random amount, <strong style={{ color: '#ff4444' }}>0 up to your current gold</strong></div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handlePlan}
                disabled={submitting || !target}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: !target ? '#3a3a3a' : 'linear-gradient(135deg, #9b59b6 0%, #6a1b9a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: !target || submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >{submitting ? 'Planning...' : '🎭 START HEIST'}</button>
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
