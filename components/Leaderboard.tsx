/**
 * Leaderboard Component
 * 
 * Displays two types of leaderboards:
 * - Daily Leaderboard: Shows users sorted by daily avatar_level
 * - Lifetime Leaderboard: Shows users sorted by lifetime_exp
 * 
 * Clicking on a user profile shows their tasks.
 * 
 * Reads from Supabase profiles table using getDailyLeaderboard() and getLifetimeLeaderboard().
 * Reads tasks using getUserTasks() when viewing a profile.
 */

'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getDailyLeaderboard, getLifetimeLeaderboard, getUserTasks } from '@/lib/leaderboard'
import { getUserProfile } from '@/lib/friends'
import { getDisplayName, supabase } from '@/lib/supabase'
import { getUserInventory, getWeaponDamage, getProtectionValue } from '@/lib/shop'
import { withRetry } from '@/lib/supabase-helpers'
import { getAvatarImage, getItemImage, getPotionTimeRemaining, getArmourTimeRemaining } from '@/lib/utils'
import type { ShopItem, UserInventory } from '@/lib/supabase'
import type { Profile, Task } from '@/lib/supabase'

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'daily' | 'lifetime'>('daily')
  const [dailyUsers, setDailyUsers] = useState<Profile[]>([])
  const [lifetimeUsers, setLifetimeUsers] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [userTasks, setUserTasks] = useState<Task[]>([])
  const [userInventory, setUserInventory] = useState<(UserInventory & { item: ShopItem })[]>([])
  // Initialize loading to true - component starts in loading state until data is fetched
  // This ensures the UI always renders (never returns null) and shows loading indicator
  const [loading, setLoading] = useState(true)
  const isLoadingRef = useRef(false)
  const mountedRef = useRef(true)
  const hasInitialDataRef = useRef(false)
  // State for hover tooltips
  const [hoveredPotionUserId, setHoveredPotionUserId] = useState<string | null>(null)
  const [hoveredArmourUserId, setHoveredArmourUserId] = useState<string | null>(null)
  const [userInventories, setUserInventories] = useState<Record<string, (UserInventory & { item: ShopItem })[]>>({})
  
  // Helper to load user inventory on hover for armour tooltip
  const loadUserInventoryOnHover = useCallback(async (userId: string) => {
    if (userInventories[userId]) return // Already loaded
    
    try {
      const inventory = await getUserInventory(userId)
      if (mountedRef.current) {
        setUserInventories(prev => ({ ...prev, [userId]: inventory }))
      }
    } catch (err) {
      console.error('Error loading user inventory for hover:', err)
    }
  }, [userInventories])

  const loadLeaderboards = useCallback(async (silent: boolean = false) => {
    // Prevent duplicate calls - skip if already loading
    if (isLoadingRef.current) {
      console.log('Leaderboard: Already loading, skipping duplicate call')
      return
    }
    
    if (!mountedRef.current) return
    
    // Set isLoading to true BEFORE starting fetch - prevents duplicate calls
    isLoadingRef.current = true
    // Only show loading UI if we haven't loaded initial data yet and not silent
    if (!silent && !hasInitialDataRef.current) {
      setLoading(true)
    }
    try {
      console.log('Loading leaderboards...')
      
      // Fetch with retry and timeout handling
      // Use longer timeout and more retries for tab visibility scenarios
      const [daily, lifetime] = await Promise.all([
        withRetry(() => getDailyLeaderboard(), { maxRetries: 3, timeout: 15000 }),
        withRetry(() => getLifetimeLeaderboard(), { maxRetries: 3, timeout: 15000 }),
      ])
      
      console.log('Leaderboard data fetched:', { daily: daily.length, lifetime: lifetime.length })
      
      // Only update if component is still mounted
      if (mountedRef.current) {
        setDailyUsers(daily)
        setLifetimeUsers(lifetime)
        // Mark that we've loaded initial data
        hasInitialDataRef.current = true
        console.log('Leaderboard state updated successfully')
      }
    } catch (err) {
      console.error('Error loading leaderboards:', err)
    } finally {
      // Always reset isLoading and loading state to false, even on error
      // CRITICAL: isLoading must ALWAYS be reset to false, otherwise component gets stuck
      isLoadingRef.current = false
      if (mountedRef.current) {
        // Only clear loading state if we were showing it (not silent refresh)
        if (!silent) {
          setLoading(false)
        }
      }
    }
  }, [])
  
  // Preload inventories for top users in background (for armour display)
  useEffect(() => {
    if (!hasInitialDataRef.current) return
    
    const currentUsers = activeTab === 'daily' ? dailyUsers : lifetimeUsers
    const topUsers = currentUsers.slice(0, 20) // Limit to top 20 to avoid too many API calls
    
    topUsers.forEach(user => {
      if (!userInventories[user.id]) {
        getUserInventory(user.id)
          .then(inventory => {
            if (mountedRef.current) {
              setUserInventories(prev => ({ ...prev, [user.id]: inventory }))
            }
          })
          .catch(() => {
            // Silently fail - inventory will load on hover if needed
          })
      }
    })
  }, [activeTab, dailyUsers, lifetimeUsers, userInventories])

  useEffect(() => {
    mountedRef.current = true
    isLoadingRef.current = false

    // Run on mount - fetch data when component first loads
    loadLeaderboards()

    // Run whenever the tab becomes active again
    // Silently refresh data in background without clearing UI
    const handler = () => {
      // Only reload if tab is visible (not hidden) and not already loading
      if (!document.hidden && mountedRef.current && !isLoadingRef.current) {
        console.log('Leaderboard: Tab became visible, silently refreshing data...')
        // Reset loading flag to allow fresh load
        isLoadingRef.current = false
        // Wait a moment for browser to be ready
        setTimeout(() => {
          if (!document.hidden && mountedRef.current && !isLoadingRef.current) {
            // Pass silent=true to refresh without showing loading state
            loadLeaderboards(true)
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
  }, [loadLeaderboards])

  const handleViewProfile = useCallback(async (userId: string) => {
    if (loading) return
    
    setLoading(true)
    try {
      const [user, tasks, inventory] = await Promise.all([
        getUserProfile(userId),
        getUserTasks(userId),
        getUserInventory(userId).catch(() => []), // Inventory is optional, don't fail if it errors
      ])
      if (mountedRef.current) {
        setUserTasks(tasks || [])
        setUserInventory(inventory || [])
        setSelectedUser(user)
      }
    } catch (err: any) {
      console.error('Error loading user profile:', err)
      // Show error to user
      if (mountedRef.current) {
        setUserTasks([])
        setUserInventory([])
        setSelectedUser(null)
        // If it's a permission error, show helpful message
        if (err?.message?.includes('permission') || err?.message?.includes('policy') || err?.message?.includes('RLS')) {
          console.error('Permission denied. Please run fix-view-user-tasks.sql in Supabase SQL Editor to allow viewing user tasks.')
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [loading])


  const getRankMedal = useCallback((rank: number) => {
    if (rank === 0) return '🥇'
    if (rank === 1) return '🥈'
    if (rank === 2) return '🥉'
    return null
  }, [])

  const getRankColor = useCallback((rank: number) => {
    if (rank === 0) return 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)'
    if (rank === 1) return 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)'
    if (rank === 2) return 'linear-gradient(135deg, #cd7f32 0%, #e6a857 100%)'
    return 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)'
  }, [])

  const currentUsers = useMemo(() => {
    return activeTab === 'daily' ? dailyUsers : lifetimeUsers
  }, [activeTab, dailyUsers, lifetimeUsers])

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>LEADERBOARD</h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          Compete with the best • Climb the ranks
        </p>
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '30px',
        background: '#0a0a0a',
        padding: '8px',
        borderRadius: '12px',
        border: '1px solid #3a3a3a'
      }}>
        <button
          onClick={() => {
            setActiveTab('daily')
            setSelectedUser(null)
          }}
          style={{
            flex: 1,
            padding: '14px 20px',
            background: activeTab === 'daily'
              ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
              : 'transparent',
            color: activeTab === 'daily' ? '#fff' : '#888',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'daily' ? '0 4px 15px rgba(255, 107, 53, 0.4)' : 'none'
          }}
        >
          💪 DAILY LEVEL
        </button>
        <button
          onClick={() => {
            setActiveTab('lifetime')
            setSelectedUser(null)
          }}
          style={{
            flex: 1,
            padding: '14px 20px',
            background: activeTab === 'lifetime'
              ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
              : 'transparent',
            color: activeTab === 'lifetime' ? '#fff' : '#888',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'lifetime' ? '0 4px 15px rgba(255, 107, 53, 0.4)' : 'none'
          }}
        >
          ⚡ LIFETIME EXP
        </button>
      </div>

      {selectedUser ? (
        <div>
          <button
            onClick={() => setSelectedUser(null)}
            style={{
              marginBottom: '25px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              color: '#fff',
              border: '1px solid #3a3a3a',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ff6b35'
              e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#3a3a3a'
              e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
            }}
          >
            ← BACK TO LEADERBOARD
          </button>
          
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            border: '1px solid #3a3a3a',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '30px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                {/* Potion Effect - Top Center */}
                {(() => {
                  const isPotionActive = selectedUser.potion_immunity_expires 
                    ? new Date(selectedUser.potion_immunity_expires) > new Date()
                    : false
                  const isHoveringPotion = hoveredPotionUserId === selectedUser.id
                  const potionTimeRemaining = getPotionTimeRemaining(selectedUser.potion_immunity_expires)
                  
                  return isPotionActive ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 3,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredPotionUserId(selectedUser.id)}
                      onMouseLeave={() => setHoveredPotionUserId(null)}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #2d5a27 0%, #1a3316 100%)',
                          border: '2px solid #4caf50',
                          borderRadius: '50%',
                          width: '36px',
                          height: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          boxShadow: '0 4px 15px rgba(76, 175, 80, 0.6)',
                          filter: 'drop-shadow(0 2px 8px rgba(76, 175, 80, 0.8))',
                          position: 'relative'
                        }}
                      >
                        🧪
                        {/* Tooltip on hover */}
                        {isHoveringPotion && potionTimeRemaining && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              padding: '8px 12px',
                              background: 'rgba(0, 0, 0, 0.95)',
                              color: '#4caf50',
                              fontSize: '12px',
                              fontWeight: 700,
                              borderRadius: '8px',
                              whiteSpace: 'nowrap',
                              border: '1px solid #4caf50',
                              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                              zIndex: 10,
                              animation: 'fadeIn 0.2s ease-out'
                            }}
                          >
                            {potionTimeRemaining}
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #4caf50'
                              }}
                            />
                            <style>{`
                              @keyframes fadeIn {
                                from { opacity: 0; transform: translateX(-50%) translateY(5px); }
                                to { opacity: 1; transform: translateX(-50%) translateY(0); }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null
                })()}
                
                <img
                  src={getAvatarImage(selectedUser.avatar_level)}
                  alt={`${selectedUser.username} avatar`}
                  style={{
                    width: '120px',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '16px',
                    border: '3px solid #ff6b35',
                    boxShadow: '0 8px 30px rgba(255, 107, 53, 0.3)',
                    position: 'relative',
                    zIndex: 1
                  }}
                />
                
                {/* Equipped Weapon - Bottom Left (overlapping avatar image) */}
                {(() => {
                  const weapons = userInventory.filter(inv => inv.item.type === 'weapon')
                  const topWeapon = weapons.length > 0 ? weapons.reduce((best, current) => {
                    const bestDamage = getWeaponDamage(best.item.effect)
                    const currentDamage = getWeaponDamage(current.item.effect)
                    return currentDamage > bestDamage ? current : best
                  }) : null
                  return topWeapon ? (
                    <img
                      src={getItemImage(topWeapon.item)}
                      alt={topWeapon.item.name}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        width: '35px',
                        height: '35px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 8px rgba(255, 68, 68, 0.6))',
                        zIndex: 2,
                        background: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: '8px',
                        padding: '3px',
                        border: '2px solid #ff4444'
                      }}
                    />
                  ) : null
                })()}
                
                {/* Equipped Armor - Bottom Right (overlapping avatar image) */}
                {(() => {
                  const now = new Date()
                  const validArmors = userInventory.filter(inv => {
                    if (inv.item.type !== 'armour') return false
                    if (inv.expires_at) {
                      const expirationDate = new Date(inv.expires_at)
                      return expirationDate > now
                    }
                    return true
                  })
                  const topArmor = validArmors.length > 0 ? validArmors.reduce((best, current) => {
                    const bestProtection = getProtectionValue(best.item.effect)
                    const currentProtection = getProtectionValue(current.item.effect)
                    return currentProtection > bestProtection ? current : best
                  }) : null
                  const isHoveringArmour = hoveredArmourUserId === selectedUser.id
                  const armourTimeRemaining = topArmor?.expires_at ? getArmourTimeRemaining(topArmor.expires_at) : null
                  
                  return topArmor ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        zIndex: 2,
                        cursor: armourTimeRemaining ? 'pointer' : 'default'
                      }}
                      onMouseEnter={() => setHoveredArmourUserId(selectedUser.id)}
                      onMouseLeave={() => setHoveredArmourUserId(null)}
                    >
                      <img
                        src={getItemImage(topArmor.item)}
                        alt={topArmor.item.name}
                        style={{
                          width: '35px',
                          height: '35px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 8px rgba(74, 158, 255, 0.6))',
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '8px',
                          padding: '3px',
                          border: '2px solid #4a9eff',
                          position: 'relative'
                        }}
                      />
                      {/* Tooltip on hover */}
                      {isHoveringArmour && armourTimeRemaining && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            right: '0',
                            marginBottom: '8px',
                            padding: '8px 12px',
                            background: 'rgba(0, 0, 0, 0.95)',
                            color: '#4a9eff',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            whiteSpace: 'nowrap',
                            border: '1px solid #4a9eff',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                            zIndex: 10,
                            animation: 'fadeIn 0.2s ease-out'
                          }}
                        >
                          {armourTimeRemaining}
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: '12px',
                              width: 0,
                              height: 0,
                              borderLeft: '6px solid transparent',
                              borderRight: '6px solid transparent',
                              borderTop: '6px solid #4a9eff'
                            }}
                          />
                          <style>{`
                            @keyframes fadeIn {
                              from { opacity: 0; transform: translateY(5px); }
                              to { opacity: 1; transform: translateY(0); }
                            }
                          `}</style>
                        </div>
                      )}
                    </div>
                  ) : null
                })()}
              </div>
              
              <h3 style={{
                fontSize: '28px',
                fontWeight: 800,
                margin: '0 0 20px 0',
                color: '#fff',
                letterSpacing: '-0.5px'
              }}>{selectedUser.username.toUpperCase()}</h3>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '15px',
              marginBottom: '30px'
            }} className="responsive-grid-3">
              <div style={{
                background: '#0a0a0a',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #3a3a3a',
                textAlign: 'center'
              }}>
                <div style={{ color: '#888', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>DAILY LEVEL</div>
                <div style={{ color: '#ff6b35', fontSize: '32px', fontWeight: 800 }}>{selectedUser.avatar_level}/10</div>
              </div>
              <div style={{
                background: '#0a0a0a',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #3a3a3a',
                textAlign: 'center'
              }}>
                <div style={{ color: '#888', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>LIFETIME EXP</div>
                <div style={{ color: '#fff', fontSize: '32px', fontWeight: 800 }}>{selectedUser.lifetime_exp}</div>
              </div>
              <div style={{
                background: '#0a0a0a',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #3a3a3a',
                textAlign: 'center'
              }}>
                <div style={{ color: '#888', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>GOLD</div>
                <div style={{ color: '#ffd700', fontSize: '32px', fontWeight: 800 }}>💰 {selectedUser.gold}</div>
              </div>
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{
                fontSize: '18px',
                fontWeight: 700,
                margin: '0 0 15px 0',
                color: '#fff'
              }}>INVENTORY</h4>
              {userInventory.length === 0 ? (
                <div style={{
                  padding: '30px',
                  background: '#0a0a0a',
                  borderRadius: '12px',
                  border: '1px solid #3a3a3a',
                  textAlign: 'center',
                  color: '#888'
                }}>
                  No items in inventory
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                  gap: '12px' 
                }}>
                  {userInventory.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        background: inv.item.type === 'weapon' 
                          ? 'linear-gradient(135deg, #8b0000 0%, #5a0000 100%)'
                          : inv.item.type === 'armour'
                          ? 'linear-gradient(135deg, #1a3a5a 0%, #0f1f2e 100%)'
                          : '#0a0a0a',
                        border: `1px solid ${inv.item.type === 'weapon' ? '#ff4444' : inv.item.type === 'armour' ? '#4a9eff' : '#3a3a3a'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        textAlign: 'center'
                      }}
                    >
                      {(inv.item.type === 'weapon' || inv.item.type === 'armour' || inv.item.type === 'pet') ? (
                        <img
                          src={getItemImage(inv.item)}
                          alt={inv.item.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'contain',
                            marginBottom: '8px',
                            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5))'
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: '40px', marginBottom: '8px' }}>
                          {inv.item.type === 'potion' ? '🧪' : '📦'}
                        </div>
                      )}
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '4px'
                      }}>
                        {inv.item.name}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#888',
                        fontWeight: 600
                      }}>
                        x{inv.quantity}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h4 style={{
                fontSize: '18px',
                fontWeight: 700,
                margin: '0 0 15px 0',
                color: '#fff'
              }}>TASKS</h4>
              {userTasks.length === 0 ? (
                <div style={{
                  padding: '30px',
                  background: '#0a0a0a',
                  borderRadius: '12px',
                  border: '1px solid #3a3a3a',
                  textAlign: 'center',
                  color: '#888'
                }}>
                  No tasks yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {userTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        padding: '14px 18px',
                        background: task.is_done
                          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)'
                          : 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                        border: task.is_done
                          ? '1px solid rgba(76, 175, 80, 0.3)'
                          : '1px solid #3a3a3a',
                        borderRadius: '10px',
                        textDecoration: task.is_done ? 'line-through' : 'none',
                        color: task.is_done ? '#888' : '#fff',
                        fontSize: '14px',
                        fontWeight: task.is_done ? 500 : 600
                      }}
                    >
                      {task.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Always render the container - never return null based on empty data */}
          {/* Show loading indicator while fetching, then show content or empty state */}
          {loading ? (
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
              <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Loading leaderboard...</p>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : currentUsers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#0a0a0a',
              borderRadius: '16px',
              border: '1px solid #3a3a3a'
            }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏆</div>
              <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
                No users on the leaderboard yet
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentUsers.map((user, index) => {
                const medal = getRankMedal(index)
                const rankColor = getRankColor(index)
                const value = activeTab === 'daily' ? user.avatar_level : user.lifetime_exp
                const label = activeTab === 'daily' ? 'LEVEL' : 'EXP'
                
                return (
                  <div
                    key={user.id}
                    onClick={() => handleViewProfile(user.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '20px',
                      background: rankColor,
                      border: index < 3 ? '2px solid #ff6b35' : '1px solid #3a3a3a',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: index < 3 
                        ? '0 8px 30px rgba(255, 107, 53, 0.3)'
                        : '0 4px 15px rgba(0, 0, 0, 0.2)',
                      gap: '20px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 107, 53, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = index < 3 
                        ? '0 8px 30px rgba(255, 107, 53, 0.3)'
                        : '0 4px 15px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {/* Rank */}
                    <div style={{
                      minWidth: '60px',
                      textAlign: 'center',
                      fontSize: '28px',
                      fontWeight: 800,
                      color: index < 3 ? '#000' : '#ff6b35'
                    }}>
                      {medal || `#${index + 1}`}
                    </div>
                    
                    {/* Avatar */}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      {/* Potion Effect - Top Center */}
                      {(() => {
                        const isPotionActive = user.potion_immunity_expires 
                          ? new Date(user.potion_immunity_expires) > new Date()
                          : false
                        const isHoveringPotion = hoveredPotionUserId === user.id
                        const potionTimeRemaining = getPotionTimeRemaining(user.potion_immunity_expires)
                        
                        return isPotionActive ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: '-12px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 3,
                              cursor: 'pointer'
                            }}
                            onMouseEnter={() => setHoveredPotionUserId(user.id)}
                            onMouseLeave={() => setHoveredPotionUserId(null)}
                          >
                            <div
                              style={{
                                background: 'linear-gradient(135deg, #2d5a27 0%, #1a3316 100%)',
                                border: '2px solid #4caf50',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                boxShadow: '0 4px 15px rgba(76, 175, 80, 0.6)',
                                filter: 'drop-shadow(0 2px 8px rgba(76, 175, 80, 0.8))',
                                position: 'relative'
                              }}
                            >
                              🧪
                              {/* Tooltip on hover */}
                              {isHoveringPotion && potionTimeRemaining && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    marginBottom: '8px',
                                    padding: '8px 12px',
                                    background: 'rgba(0, 0, 0, 0.95)',
                                    color: '#4caf50',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    whiteSpace: 'nowrap',
                                    border: '1px solid #4caf50',
                                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                                    zIndex: 10,
                                    animation: 'fadeIn 0.2s ease-out'
                                  }}
                                >
                                  {potionTimeRemaining}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderTop: '6px solid #4caf50'
                                    }}
                                  />
                                  <style>{`
                                    @keyframes fadeIn {
                                      from { opacity: 0; transform: translateX(-50%) translateY(5px); }
                                      to { opacity: 1; transform: translateX(-50%) translateY(0); }
                                    }
                                  `}</style>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null
                      })()}
                      
                      {/* Armour Effect - Bottom Right (will show after avatar is loaded) */}
                      {(() => {
                        const inventory = userInventories[user.id] || []
                        const now = new Date()
                        const validArmors = inventory.filter(inv => {
                          if (inv.item.type !== 'armour') return false
                          if (inv.expires_at) {
                            const expirationDate = new Date(inv.expires_at)
                            return expirationDate > now
                          }
                          return true
                        })
                        const topArmor = validArmors.length > 0 ? validArmors.reduce((best, current) => {
                          const bestProtection = getProtectionValue(best.item.effect)
                          const currentProtection = getProtectionValue(current.item.effect)
                          return currentProtection > bestProtection ? current : best
                        }) : null
                        const isHoveringArmour = hoveredArmourUserId === user.id
                        const armourTimeRemaining = topArmor?.expires_at ? getArmourTimeRemaining(topArmor.expires_at) : null
                        
                        return topArmor ? (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '-8px',
                              right: '-8px',
                              zIndex: 3,
                              cursor: armourTimeRemaining ? 'pointer' : 'default'
                            }}
                            onMouseEnter={() => {
                              setHoveredArmourUserId(user.id)
                              loadUserInventoryOnHover(user.id)
                            }}
                            onMouseLeave={() => setHoveredArmourUserId(null)}
                          >
                            <img
                              src={getItemImage(topArmor.item)}
                              alt={topArmor.item.name}
                              style={{
                                width: '28px',
                                height: '28px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 2px 8px rgba(74, 158, 255, 0.6))',
                                background: 'rgba(0, 0, 0, 0.7)',
                                borderRadius: '8px',
                                padding: '3px',
                                border: '2px solid #4a9eff',
                                position: 'relative'
                              }}
                            />
                            {/* Tooltip on hover */}
                            {isHoveringArmour && armourTimeRemaining && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  right: '0',
                                  marginBottom: '8px',
                                  padding: '8px 12px',
                                  background: 'rgba(0, 0, 0, 0.95)',
                                  color: '#4a9eff',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  whiteSpace: 'nowrap',
                                  border: '1px solid #4a9eff',
                                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                                  zIndex: 10,
                                  animation: 'fadeIn 0.2s ease-out'
                                }}
                              >
                                {armourTimeRemaining}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '12px',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '6px solid transparent',
                                    borderRight: '6px solid transparent',
                                    borderTop: '6px solid #4a9eff'
                                  }}
                                />
                                <style>{`
                                  @keyframes fadeIn {
                                    from { opacity: 0; transform: translateY(5px); }
                                    to { opacity: 1; transform: translateY(0); }
                                  }
                                `}</style>
                              </div>
                            )}
                          </div>
                        ) : null
                      })()}
                      
                      <img
                        src={getAvatarImage(user.avatar_level)}
                        alt={`${getDisplayName(user)} avatar`}
                        style={{
                          width: '70px',
                          height: '70px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '2px solid rgba(255, 107, 53, 0.5)',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                          position: 'relative',
                          zIndex: 1
                        }}
                      />
                    </div>
                    
                    {/* User Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: index < 3 ? '#000' : '#fff',
                        marginBottom: '6px',
                        letterSpacing: '-0.5px'
                      }}>
                        {getDisplayName(user).toUpperCase()}
                        {user.display_name && (
                          <span style={{
                            fontSize: '12px',
                            color: index < 3 ? '#666' : '#888',
                            fontWeight: 500,
                            marginLeft: '8px',
                            fontStyle: 'italic'
                          }}>
                            ({user.username})
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: index < 3 ? '#333' : '#888'
                      }}>
                        {label}: <span style={{ color: index < 3 ? '#000' : '#ff6b35', fontWeight: 800 }}>{value}</span>
                      </div>
                    </div>
                    
                    {/* Value Badge */}
                    <div style={{
                      minWidth: '100px',
                      textAlign: 'center',
                      padding: '12px 20px',
                      background: index < 3 
                        ? 'rgba(0, 0, 0, 0.2)'
                        : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                      borderRadius: '12px',
                      border: index < 3 ? '1px solid rgba(0, 0, 0, 0.3)' : 'none'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 800,
                        color: index < 3 ? '#000' : '#fff',
                        lineHeight: '1'
                      }}>
                        {value}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: index < 3 ? '#333' : '#fff',
                        opacity: 0.8,
                        marginTop: '4px'
                      }}>
                        {label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

