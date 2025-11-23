/**
 * Shop Component
 * 
 * Displays shop items and allows purchasing:
 * - Shows all available items (armour, weapons, potions, pets)
 * - Displays item cost and effects
 * - Allows purchasing items with gold
 * - Shows user's inventory
 * - Allows using items (weapons to attack, potions for immunity, etc.)
 * 
 * Communicates with Supabase:
 * - Reads shop_items table using getShopItems()
 * - Reads user_inventory table using getUserInventory()
 * - Purchases items using purchaseItem() which updates profiles (gold) and user_inventory
 * - Uses items with useItem() which applies effects
 */

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getShopItems, purchaseItem, getUserInventory, useItem, getEffectDescription, getProtectionValue, getWeaponDamage } from '@/lib/shop'
import { getDailyLeaderboard } from '@/lib/leaderboard'
import { getDisplayName, supabase, resetSupabaseClient, abortAllPendingRequests } from '@/lib/supabase'
import { isEliteUser } from '@/lib/elite'
import { withRetry, refreshSession, wasTabRecentlyHidden } from '@/lib/supabase-helpers'
import { showModal, showConfirm } from '@/lib/modal'
import { getAvatarImage, getItemImage } from '@/lib/utils'
import AttackAnimation from '@/components/AttackAnimation'
import type { ShopItem, UserInventory, Profile } from '@/lib/supabase'

interface ShopProps {
  userId: string
  onPurchase: () => void
}

export default function Shop({ userId, onPurchase }: ShopProps) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [inventory, setInventory] = useState<(UserInventory & { item: ShopItem })[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [selectedTarget, setSelectedTarget] = useState('')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isElite, setIsElite] = useState(false)
  const [showAttackAnimation, setShowAttackAnimation] = useState(false)
  const [attackTarget, setAttackTarget] = useState<{ avatar: string; name: string; sword: string } | null>(null)
  const isLoadingRef = useRef(false)
  const mountedRef = useRef(true)
  const hasInitialDataRef = useRef(false)

  const loadData = useCallback(async (silent: boolean = false) => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      console.log('Shop: Already loading, skipping duplicate call')
      return
    }

    if (!mountedRef.current) return

    isLoadingRef.current = true
    // Only show loading UI if we haven't loaded initial data yet and not silent
    if (!silent && !hasInitialDataRef.current) {
      setLoading(true)
    }
    try {
      const [shopItems, userInv, users, eliteStatus] = await Promise.all([
        withRetry(() => getShopItems(), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => getUserInventory(userId), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => getDailyLeaderboard(), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => isEliteUser(userId), { maxRetries: 3, timeout: 15000 }),
      ])
      
      if (mountedRef.current) {
        setItems(shopItems)
        setInventory(userInv)
        setAllUsers(users.filter((u) => u.id !== userId))
        setIsElite(eliteStatus)
        // Mark that we've loaded initial data
        hasInitialDataRef.current = true
      }
    } catch (err) {
      console.error('Error loading shop data:', err)
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

    // If tab was recently hidden, reset client before first load
    const initializeAndLoad = async () => {
      if (wasTabRecentlyHidden()) {
        abortAllPendingRequests()
        resetSupabaseClient()
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      if (mountedRef.current) {
        loadData()
      }
    }
    initializeAndLoad()

    // Refresh data when tab becomes visible
    const handler = async () => {
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
          loadData(true)
        }
      }, 1500)
    }

    // Listen for visibility changes (when user switches tabs)
    document.addEventListener("visibilitychange", handler)

    return () => {
      mountedRef.current = false
      document.removeEventListener("visibilitychange", handler)
      isLoadingRef.current = false
    }
  }, [loadData])

  const handlePurchase = useCallback(async (itemId: string) => {
    if (loading) return
    
    const confirmed = await showConfirm('Purchase Item', 'Purchase this item?')
    if (!confirmed) return

    setLoading(true)
    try {
      await purchaseItem(userId, itemId)
      await loadData()
      onPurchase()
      await showModal('Success', 'Item purchased!', 'success')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to purchase item', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, loading, loadData, onPurchase])

  const handleUseItem = useCallback(async (inventoryId: string, itemType: string) => {
    if (itemType === 'weapon') {
      if (!selectedTarget) {
        await showModal('Warning', 'Please select a target user', 'warning')
        return
      }
      const confirmed = await showConfirm('Attack User', 'Attack this user? This will reduce their lifetime EXP!')
      if (!confirmed) return

      // Get target user and weapon info for animation
      const targetUser = allUsers.find(u => u.id === selectedTarget)
      if (targetUser) {
        const weaponItem = inventory.find(inv => inv.id === inventoryId)?.item
        const swordImage = weaponItem ? getItemImage(weaponItem) : '/Wooden Sword.png'
        

        // Show attack animation
        setAttackTarget({
          avatar: getAvatarImage(targetUser.avatar_level),
          name: getDisplayName(targetUser),
          sword: swordImage
        })
        setShowAttackAnimation(true)
        
        // Wait for animation to complete (3 seconds) before executing attack
        await new Promise(resolve => setTimeout(resolve, 3000))
        setShowAttackAnimation(false)
        setAttackTarget(null)
      }
    } else if (itemType === 'potion') {
      const confirmed = await showConfirm('Use Potion', 'Use this potion? You will gain 24h immunity!')
      if (!confirmed) return
    } else if (itemType === 'name_change') {
      if (!selectedTarget) {
        await showModal('Warning', 'Please select a target user', 'warning')
        return
      }
      if (!customName || customName.trim().length === 0) {
        await showModal('Warning', 'Please enter a name', 'warning')
        return
      }
      const targetUser = allUsers.find(u => u.id === selectedTarget)
      const confirmed = await showConfirm('Change Name', `Change ${targetUser ? getDisplayName(targetUser) : 'this user'}'s name to "${customName.trim()}"?`)
      if (!confirmed) return
    } else if (itemType === 'name_restore') {
      const confirmed = await showConfirm('Restore Name', 'Restore your name back to original? This will remove any custom name set by others.')
      if (!confirmed) return
    } else {
      await showModal('Error', 'This item type cannot be used', 'error')
      return
    }

    setLoading(true)
    try {
      await useItem(
        userId,
        inventoryId,
        (itemType === 'weapon' || itemType === 'name_change') ? selectedTarget : undefined,
        itemType === 'name_change' ? customName : undefined
      )
      await loadData()
      const nameToShow = customName.trim()
      setCustomName('')
      setSelectedTarget('')
      if (itemType === 'name_change') {
        await showModal('Success', `Name changed successfully! The target's name is now "${nameToShow}"`, 'success')
      } else {
        await showModal('Success', 'Item used!', 'success')
      }
    } catch (err: any) {
      console.error('Error using item:', err)
      await showModal('Error', err.message || 'Failed to use item. Check browser console for details.', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedTarget, customName, allUsers, inventory, userId, loadData])

  const getItemEmoji = useCallback((type: string) => {
    switch (type) {
      case 'weapon': return '⚔️'
      case 'armour': return '🛡️'
      case 'potion': return '🧪'
      case 'pet': return '🐾'
      case 'name_change': return '📜'
      case 'name_restore': return '✨'
      default: return '📦'
    }
  }, [])


  const getItemTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'weapon': return { bg: 'linear-gradient(135deg, #8b0000 0%, #5a0000 100%)', border: '#ff4444', glow: 'rgba(255, 68, 68, 0.4)' }
      case 'armour': return { bg: 'linear-gradient(135deg, #1a3a5a 0%, #0f1f2e 100%)', border: '#4a9eff', glow: 'rgba(74, 158, 255, 0.4)' }
      case 'potion': return { bg: 'linear-gradient(135deg, #2d5a27 0%, #1a3316 100%)', border: '#4caf50', glow: 'rgba(76, 175, 80, 0.4)' }
      case 'pet': return { bg: 'linear-gradient(135deg, #5a3a1a 0%, #3d2811 100%)', border: '#d4a574', glow: 'rgba(212, 165, 116, 0.4)' }
      default: return { bg: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', border: '#3a3a3a', glow: 'rgba(0, 0, 0, 0.2)' }
    }
  }, [])

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #9b59b6 50%, #ffd700 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>SHOP</h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          Premium gear • Power up your arsenal
        </p>
      </div>

      {/* Available Items */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#9b59b6',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>🛒</span> AVAILABLE ITEMS
        </h3>
        {loading && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #2a2a2a',
              borderTop: '4px solid #9b59b6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Loading shop...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }} className="responsive-grid">
            {items.map((item) => {
              const typeColors = getItemTypeColor(item.type)
              return (
                <div
                  key={item.id}
                  style={{
                    background: typeColors.bg,
                    border: `2px solid ${typeColors.border}`,
                    borderRadius: '16px',
                    padding: '25px',
                    transition: 'all 0.3s ease',
                    boxShadow: `0 8px 30px ${typeColors.glow}`,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)'
                    e.currentTarget.style.boxShadow = `0 12px 40px ${typeColors.glow}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = `0 8px 30px ${typeColors.glow}`
                  }}
                >
                  <div style={{
                    textAlign: 'center',
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: item.type === 'pet' ? '120px' : '80px'
                  }}>
                    {(item.type === 'weapon' || item.type === 'armour' || item.type === 'pet') ? (
                      <img
                        src={getItemImage(item)}
                        alt={item.name}
                        style={{
                          maxWidth: item.type === 'pet' ? '120px' : '80px',
                          maxHeight: item.type === 'pet' ? '120px' : '80px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))'
                        }}
                      />
                    ) : (
                      <span style={{
                        fontSize: '60px',
                        filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))'
                      }}>
                        {getItemEmoji(item.type)}
                      </span>
                    )}
                  </div>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#fff',
                    textAlign: 'center',
                    letterSpacing: '-0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    {item.name.toUpperCase()}
                    {(item.type === 'weapon' || item.type === 'name_change') && !isElite && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        background: 'rgba(255, 68, 68, 0.2)',
                        border: '1px solid rgba(255, 68, 68, 0.4)',
                        borderRadius: '6px',
                        color: '#ff4444',
                        fontWeight: 700
                      }}>ELITE ONLY</span>
                    )}
                  </h4>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '10px',
                    marginBottom: '15px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#ccc'
                    }}>
                      <span>TYPE</span>
                      <span style={{ color: typeColors.border, textTransform: 'uppercase' }}>{item.type}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#ccc',
                      marginBottom: '8px'
                    }}>
                      <span>EFFECT</span>
                      <span style={{ color: '#fff', textAlign: 'right', maxWidth: '60%' }}>
                        {getEffectDescription(item.effect)}
                      </span>
                    </div>
                    {item.type === 'armour' && (
                      <>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#ccc',
                          marginBottom: '8px'
                        }}>
                          <span>🛡️ PROTECTION</span>
                          <span style={{ color: '#4a9eff', fontWeight: 800, fontSize: '14px' }}>
                            {getProtectionValue(item.effect)} PROT.
                          </span>
                        </div>
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(74, 158, 255, 0.1)',
                          border: '1px solid rgba(74, 158, 255, 0.3)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#4a9eff',
                          fontWeight: 600,
                          textAlign: 'center'
                        }}>
                          ⏰ Lasts for 2 weeks
                        </div>
                      </>
                    )}
                    {item.type === 'weapon' && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#ccc',
                        marginBottom: !isElite ? '8px' : '0'
                      }}>
                        <span>⚔️ DAMAGE</span>
                        <span style={{ color: '#ff4444', fontWeight: 800, fontSize: '14px' }}>
                          {getWeaponDamage(item.effect)} EXP
                        </span>
                      </div>
                    )}
                    {(item.type === 'weapon' || item.type === 'name_change') && !isElite && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(255, 68, 68, 0.1)',
                        border: '1px solid rgba(255, 68, 68, 0.3)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#ff8888',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        ⚠️ Only available to the first 3 users who complete all 10 tasks!
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handlePurchase(item.id)}
                    disabled={loading || ((item.type === 'weapon' || item.type === 'name_change') && !isElite)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: loading || ((item.type === 'weapon' || item.type === 'name_change') && !isElite)
                        ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                        : 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                      color: loading || ((item.type === 'weapon' || item.type === 'name_change') && !isElite) ? '#888' : '#000',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: loading || ((item.type === 'weapon' || item.type === 'name_change') && !isElite) ? 'not-allowed' : 'pointer',
                      fontWeight: 800,
                      fontSize: '16px',
                      transition: 'all 0.3s ease',
                      boxShadow: loading || ((item.type === 'weapon' || item.type === 'name_change') && !isElite) ? 'none' : '0 4px 15px rgba(255, 215, 0, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && !((item.type === 'weapon' || item.type === 'name_change') && !isElite)) {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && !((item.type === 'weapon' || item.type === 'name_change') && !isElite)) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)'
                      }
                    }}
                  >
                    <span>💰</span> 
                    {(item.type === 'weapon' || item.type === 'name_change') && !isElite 
                      ? 'ELITE ONLY' 
                      : `${item.cost} GOLD`}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 20px 0',
          color: '#9b59b6',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>🎒</span> YOUR INVENTORY
          <span style={{
            background: 'rgba(155, 89, 182, 0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600
          }}>{inventory.length}</span>
        </h3>
        {inventory.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            background: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #3a3a3a',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎒</div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
              Your inventory is empty. Buy some items!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {inventory.map((inv) => {
              const typeColors = getItemTypeColor(inv.item.type)
              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    padding: '20px',
                    background: typeColors.bg,
                    border: `2px solid ${typeColors.border}`,
                    borderRadius: '14px',
                    transition: 'all 0.3s ease',
                    boxShadow: `0 4px 20px ${typeColors.glow}`,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)'
                    e.currentTarget.style.boxShadow = `0 6px 25px ${typeColors.glow}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)'
                    e.currentTarget.style.boxShadow = `0 4px 20px ${typeColors.glow}`
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '20px', 
                    flex: 1,
                    minWidth: 0,
                    width: '100%'
                  }}>
                    {(inv.item.type === 'weapon' || inv.item.type === 'armour' || inv.item.type === 'pet') ? (
                      <img
                        src={getItemImage(inv.item)}
                        alt={inv.item.name}
                        style={{
                          width: inv.item.type === 'pet' ? '90px' : '60px',
                          height: inv.item.type === 'pet' ? '90px' : '60px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))'
                        }}
                      />
                    ) : (
                      <div style={{
                        fontSize: '50px',
                        filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))'
                      }}>
                        {getItemEmoji(inv.item.type)}
                      </div>
                    )}
                    <div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: '#fff',
                        marginBottom: '6px',
                        letterSpacing: '-0.5px'
                      }}>
                        {inv.item.name.toUpperCase()}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: typeColors.border,
                        fontWeight: 600,
                        marginBottom: '4px'
                      }}>
                        Quantity: <span style={{ color: '#ffd700', fontWeight: 800 }}>{inv.quantity}</span>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#ccc',
                        fontWeight: 500,
                        marginBottom: '4px'
                      }}>
                        {getEffectDescription(inv.item.effect)}
                      </div>
                      {inv.item.type === 'armour' && (
                        <div style={{
                          fontSize: '12px',
                          color: '#4a9eff',
                          fontWeight: 700
                        }}>
                          🛡️ Protection: <span style={{ color: '#4a9eff', fontWeight: 800 }}>{getProtectionValue(inv.item.effect)} PROT.</span>
                        </div>
                      )}
                      {inv.item.type === 'weapon' && (
                        <div style={{
                          fontSize: '12px',
                          color: '#ff4444',
                          fontWeight: 700
                        }}>
                          ⚔️ Damage: <span style={{ color: '#ff4444', fontWeight: 800 }}>{getWeaponDamage(inv.item.effect)} EXP</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    alignItems: 'center', 
                    flexWrap: 'wrap',
                    width: '100%',
                    maxWidth: '100%'
                  }} className="responsive-flex">
                    {(inv.item.type === 'weapon' || inv.item.type === 'name_change') && (
                      <select
                        value={selectedTarget}
                        onChange={(e) => setSelectedTarget(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          background: '#0a0a0a',
                          border: `1px solid ${inv.item.type === 'weapon' ? '#ff4444' : '#ff6b9d'}`,
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minWidth: '150px',
                          flex: '1 1 auto',
                          maxWidth: '100%'
                        }}
                      >
                        <option value="">Select target...</option>
                        {allUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.display_name || user.username}
                            {user.display_name && ` (${user.username})`}
                          </option>
                        ))}
                      </select>
                    )}
                    {inv.item.type === 'name_change' && (
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Enter new name..."
                        maxLength={30}
                        style={{
                          padding: '10px 14px',
                          background: '#0a0a0a',
                          border: '1px solid #ff6b9d',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                          minWidth: '180px',
                          flex: '1 1 auto',
                          maxWidth: '100%',
                          outline: 'none'
                        }}
                      />
                    )}
                    {(inv.item.type === 'weapon' || inv.item.type === 'potion' || inv.item.type === 'name_change' || inv.item.type === 'name_restore') && (
                      <button
                        onClick={() => handleUseItem(inv.id, inv.item.type)}
                        disabled={
                          loading ||
                          (inv.item.type === 'weapon' && !selectedTarget) ||
                          (inv.item.type === 'name_change' && (!selectedTarget || !customName.trim()))
                        }
                        style={{
                          padding: '12px 24px',
                          background: inv.item.type === 'weapon'
                            ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)'
                            : inv.item.type === 'potion'
                            ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                            : inv.item.type === 'name_change'
                            ? 'linear-gradient(135deg, #ff6b9d 0%, #cc4a7a 100%)'
                            : 'linear-gradient(135deg, #ffd700 0%, #ffb300 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: (loading ||
                            (inv.item.type === 'weapon' && !selectedTarget) ||
                            (inv.item.type === 'name_change' && (!selectedTarget || !customName.trim()))) ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                          fontSize: '14px',
                          transition: 'all 0.3s ease',
                          boxShadow: (loading ||
                            (inv.item.type === 'weapon' && !selectedTarget) ||
                            (inv.item.type === 'name_change' && (!selectedTarget || !customName.trim())))
                            ? 'none'
                            : `0 4px 15px ${inv.item.type === 'weapon' ? 'rgba(255, 68, 68, 0.4)' : inv.item.type === 'potion' ? 'rgba(76, 175, 80, 0.4)' : inv.item.type === 'name_change' ? 'rgba(255, 107, 157, 0.4)' : 'rgba(255, 215, 0, 0.4)'}`,
                          flex: '0 1 auto',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading &&
                            !(inv.item.type === 'weapon' && !selectedTarget) &&
                            !(inv.item.type === 'name_change' && (!selectedTarget || !customName.trim()))) {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = `0 6px 20px ${inv.item.type === 'weapon' ? 'rgba(255, 68, 68, 0.5)' : inv.item.type === 'potion' ? 'rgba(76, 175, 80, 0.5)' : inv.item.type === 'name_change' ? 'rgba(255, 107, 157, 0.5)' : 'rgba(255, 215, 0, 0.5)'}`
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading &&
                            !(inv.item.type === 'weapon' && !selectedTarget) &&
                            !(inv.item.type === 'name_change' && (!selectedTarget || !customName.trim()))) {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = `0 4px 15px ${inv.item.type === 'weapon' ? 'rgba(255, 68, 68, 0.4)' : inv.item.type === 'potion' ? 'rgba(76, 175, 80, 0.4)' : inv.item.type === 'name_change' ? 'rgba(255, 107, 157, 0.4)' : 'rgba(255, 215, 0, 0.4)'}`
                          }
                        }}
                      >
                        {inv.item.type === 'weapon' ? '⚔️ ATTACK' :
                         inv.item.type === 'potion' ? '🧪 USE' :
                         inv.item.type === 'name_change' ? '✏️ CHANGE NAME' :
                         '✨ RESTORE NAME'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Attack Animation */}
      {attackTarget && (
        <AttackAnimation
          isOpen={showAttackAnimation}
          targetAvatar={attackTarget.avatar}
          targetName={attackTarget.name}
          swordImage={attackTarget.sword}
          onComplete={() => {
            setShowAttackAnimation(false)
            setAttackTarget(null)
          }}
        />
      )}
    </div>
  )
}

