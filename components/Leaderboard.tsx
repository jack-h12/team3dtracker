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

import { useState, useEffect } from 'react'
import { getDailyLeaderboard, getLifetimeLeaderboard, getUserTasks } from '@/lib/leaderboard'
import { getUserProfile } from '@/lib/friends'
import { getDisplayName } from '@/lib/supabase'
import { getUserInventory, getWeaponDamage, getProtectionValue } from '@/lib/shop'
import type { ShopItem, UserInventory } from '@/lib/supabase'
import type { Profile, Task } from '@/lib/supabase'

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'daily' | 'lifetime'>('daily')
  const [dailyUsers, setDailyUsers] = useState<Profile[]>([])
  const [lifetimeUsers, setLifetimeUsers] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [userTasks, setUserTasks] = useState<Task[]>([])
  const [userInventory, setUserInventory] = useState<(UserInventory & { item: ShopItem })[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadLeaderboards()
  }, [])

  const loadLeaderboards = async () => {
    setLoading(true)
    try {
      const [daily, lifetime] = await Promise.all([
        getDailyLeaderboard(),
        getLifetimeLeaderboard(),
      ])
      setDailyUsers(daily)
      setLifetimeUsers(lifetime)
    } catch (err) {
      console.error('Error loading leaderboards:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewProfile = async (userId: string) => {
    setLoading(true)
    try {
      const [user, tasks, inventory] = await Promise.all([
        getUserProfile(userId),
        getUserTasks(userId),
        getUserInventory(userId),
      ])
      setUserTasks(tasks)
      setUserInventory(inventory)
      setSelectedUser(user)
    } catch (err) {
      console.error('Error loading user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const getItemImage = (item: ShopItem): string => {
    if (item.type === 'weapon') {
      const name = item.name.toLowerCase()
      if (name.includes('wooden')) return '/Wooden Sword.png'
      if (name.includes('iron')) return '/iron sword.webp'
      if (name.includes('diamond')) return '/diamond sword.webp'
      if (item.cost <= 50) return '/Wooden Sword.png'
      if (item.cost <= 150) return '/iron sword.webp'
      return '/diamond sword.webp'
    } else if (item.type === 'armour') {
      const name = item.name.toLowerCase()
      if (name.includes('leather')) return '/leather armour.png'
      if (name.includes('iron')) return '/iron armour.png'
      if (name.includes('diamond') || name.includes('steel')) return '/diamond armour.webp'
      if (item.cost <= 100) return '/leather armour.png'
      if (item.cost <= 250) return '/iron armour.png'
      return '/diamond armour.webp'
    }
    return ''
  }

  const getPotionTimeRemaining = (expiresAt: string | null | undefined): string => {
    if (!expiresAt) return ''
    const expires = new Date(expiresAt)
    const now = new Date()
    const diff = expires.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    }
    return `${minutes}m remaining`
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

  const getRankMedal = (rank: number) => {
    if (rank === 0) return '🥇'
    if (rank === 1) return '🥈'
    if (rank === 2) return '🥉'
    return null
  }

  const getRankColor = (rank: number) => {
    if (rank === 0) return 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)'
    if (rank === 1) return 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)'
    if (rank === 2) return 'linear-gradient(135deg, #cd7f32 0%, #e6a857 100%)'
    return 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)'
  }

  const currentUsers = activeTab === 'daily' ? dailyUsers : lifetimeUsers
  const sortKey = activeTab === 'daily' ? 'avatar_level' : 'lifetime_exp'

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
                  return isPotionActive ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 3,
                        cursor: 'pointer'
                      }}
                      title={getPotionTimeRemaining(selectedUser.potion_immunity_expires)}
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
                          filter: 'drop-shadow(0 2px 8px rgba(76, 175, 80, 0.8))'
                        }}
                      >
                        🧪
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
                  const armors = userInventory.filter(inv => inv.item.type === 'armour')
                  const topArmor = armors.length > 0 ? armors.reduce((best, current) => {
                    const bestProtection = getProtectionValue(best.item.effect)
                    const currentProtection = getProtectionValue(current.item.effect)
                    return currentProtection > bestProtection ? current : best
                  }) : null
                  return topArmor ? (
                    <img
                      src={getItemImage(topArmor.item)}
                      alt={topArmor.item.name}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        width: '35px',
                        height: '35px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 8px rgba(74, 158, 255, 0.6))',
                        zIndex: 2,
                        background: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: '8px',
                        padding: '3px',
                        border: '2px solid #4a9eff'
                    }}
                    />
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
                    <img
                      src={getAvatarImage(user.avatar_level)}
                      alt={`${getDisplayName(user)} avatar`}
                      style={{
                        width: '70px',
                        height: '70px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '2px solid rgba(255, 107, 53, 0.5)',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                      }}
                    />
                    
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

