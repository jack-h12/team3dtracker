/**
 * Avatar Component
 * 
 * Displays the user's avatar with level-based appearance.
 * - Avatar appearance changes based on avatar_level (0-10)
 * - Shows current daily level and lifetime experience
 * - Displays gold amount
 * 
 * Reads from Supabase profiles table to get avatar_level, lifetime_exp, and gold.
 */

'use client'

import { useState, useEffect } from 'react'
import { getDisplayName } from '@/lib/supabase'
import { getUserInventory, getWeaponDamage, getProtectionValue } from '@/lib/shop'
import type { Profile, ShopItem, UserInventory } from '@/lib/supabase'

interface AvatarProps {
  profile: Profile
  showEquipped?: boolean // Whether to show equipped items on avatar
}

export default function Avatar({ profile, showEquipped = true }: AvatarProps) {
  const [equippedItems, setEquippedItems] = useState<(UserInventory & { item: ShopItem })[]>([])
  const [showPotionTooltip, setShowPotionTooltip] = useState(false)

  useEffect(() => {
    if (showEquipped) {
      loadEquippedItems()
    }
  }, [profile.id, showEquipped])

  const loadEquippedItems = async () => {
    try {
      const inventory = await getUserInventory(profile.id)
      // Get weapons and armor only
      const weaponsAndArmor = inventory.filter(inv => 
        inv.item.type === 'weapon' || inv.item.type === 'armour'
      )
      setEquippedItems(weaponsAndArmor)
    } catch (err) {
      console.error('Error loading equipped items:', err)
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

  // Find most powerful weapon (highest damage)
  const weapons = equippedItems.filter(inv => inv.item.type === 'weapon')
  const topWeapon = weapons.length > 0 ? weapons.reduce((best, current) => {
    const bestDamage = getWeaponDamage(best.item.effect)
    const currentDamage = getWeaponDamage(current.item.effect)
    return currentDamage > bestDamage ? current : best
  }) : null

  // Find most powerful armor (highest protection)
  const armors = equippedItems.filter(inv => inv.item.type === 'armour')
  const topArmor = armors.length > 0 ? armors.reduce((best, current) => {
    const bestProtection = getProtectionValue(best.item.effect)
    const currentProtection = getProtectionValue(current.item.effect)
    return currentProtection > bestProtection ? current : best
  }) : null

  // Check if potion is active
  const isPotionActive = profile.potion_immunity_expires 
    ? new Date(profile.potion_immunity_expires) > new Date()
    : false
  
  const getPotionTimeRemaining = (): string => {
    if (!profile.potion_immunity_expires) return ''
    const expires = new Date(profile.potion_immunity_expires)
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
  // Get avatar image based on level
  const getAvatarImage = (level: number): string => {
    if (level === 0) return '/smeagol-level1.webp' // Use level 1 image for level 0
    if (level === 1) return '/smeagol-level1.webp'
    if (level === 2) return '/babythanos-level2.jpg'
    if (level === 3) return '/boy thanos-level3.jpg'
    if (level === 4) return '/young thanos-level4.jpg'
    if (level === 5) return '/thanos one stone-level5.jpg'
    if (level === 6) return '/thanos two stones-level6.avif'
    if (level === 7) return '/thanos 3 stones-level7.jpg'
    if (level === 8) return '/thanos 4 stones-level8.jpg'
    if (level === 9) return '/thanos 5 stones-level9.jpg'
    return '/goku thanos-level10.webp' // level 10
  }

  const getAvatarColor = (level: number) => {
    if (level === 0) return '#cccccc'
    if (level <= 2) return '#ffeb3b'
    if (level <= 4) return '#ff9800'
    if (level <= 6) return '#4caf50'
    if (level <= 8) return '#2196f3'
    return '#ff6b35' // Changed to match theme for max level
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      border: '1px solid #3a3a3a',
      borderRadius: '16px',
      padding: 'clamp(20px, 4vw, 30px)',
      textAlign: 'center',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          filter: `drop-shadow(0 0 20px ${getAvatarColor(profile.avatar_level)})`,
          position: 'relative'
        }}
      >
        {/* Potion Effect - Top Center */}
        {showEquipped && isPotionActive && (
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3,
              cursor: 'pointer'
            }}
            onMouseEnter={() => setShowPotionTooltip(true)}
            onMouseLeave={() => setShowPotionTooltip(false)}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #2d5a27 0%, #1a3316 100%)',
                border: '2px solid #4caf50',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                boxShadow: '0 4px 15px rgba(76, 175, 80, 0.6)',
                filter: 'drop-shadow(0 2px 8px rgba(76, 175, 80, 0.8))',
                position: 'relative'
              }}
            >
              🧪
              {/* Tooltip on hover */}
              {showPotionTooltip && (
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
                  {getPotionTimeRemaining()}
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
        )}
        
        {/* Avatar Image */}
        <img
          src={getAvatarImage(profile.avatar_level)}
          alt={`Level ${profile.avatar_level} avatar`}
          style={{
            width: 'clamp(100px, 20vw, 140px)',
            height: 'clamp(100px, 20vw, 140px)',
            objectFit: 'cover',
            borderRadius: '16px',
            border: `3px solid ${getAvatarColor(profile.avatar_level)}`,
            boxShadow: `0 8px 30px rgba(255, 107, 53, 0.3)`,
            position: 'relative',
            zIndex: 1
          }}
        />
        
        {/* Equipped Weapon - Bottom Left (overlapping avatar) */}
        {showEquipped && topWeapon && (
          <img
            src={getItemImage(topWeapon.item)}
            alt={topWeapon.item.name}
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              width: '40px',
              height: '40px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(255, 68, 68, 0.6))',
              zIndex: 2,
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
              padding: '4px',
              border: '2px solid #ff4444'
            }}
          />
        )}
        
        {/* Equipped Armor - Bottom Right (overlapping avatar) */}
        {showEquipped && topArmor && (
          <img
            src={getItemImage(topArmor.item)}
            alt={topArmor.item.name}
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              width: '40px',
              height: '40px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(74, 158, 255, 0.6))',
              zIndex: 2,
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
              padding: '4px',
              border: '2px solid #4a9eff'
            }}
          />
        )}
      </div>
      <h3 style={{
        fontSize: 'clamp(18px, 4vw, 24px)',
        fontWeight: 800,
        margin: '0 0 25px 0',
        color: '#fff',
        letterSpacing: '-0.5px'
      }}>
        {getDisplayName(profile).toUpperCase()}
        {profile.display_name && (
          <span style={{
            fontSize: '14px',
            color: '#888',
            fontWeight: 500,
            marginLeft: '10px',
            fontStyle: 'italic'
          }}>
            ({profile.username})
          </span>
        )}
      </h3>
      
      <div style={{
        background: '#0a0a0a',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #3a3a3a'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
          paddingBottom: '15px',
          borderBottom: '1px solid #2a2a2a'
        }}>
          <span style={{ color: '#888', fontSize: '13px', fontWeight: 600 }}>DAILY LEVEL</span>
          <span style={{
            color: '#ff6b35',
            fontSize: 'clamp(16px, 3.5vw, 20px)',
            fontWeight: 800
          }}>{profile.avatar_level}/10</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
          paddingBottom: '15px',
          borderBottom: '1px solid #2a2a2a'
        }}>
          <span style={{ color: '#888', fontSize: '13px', fontWeight: 600 }}>LIFETIME EXP</span>
          <span style={{
            color: '#fff',
            fontSize: 'clamp(16px, 3.5vw, 20px)',
            fontWeight: 800
          }}>{profile.lifetime_exp}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#888', fontSize: '13px', fontWeight: 600 }}>GOLD</span>
          <span style={{
            color: '#ffd700',
            fontSize: 'clamp(16px, 3.5vw, 20px)',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>💰</span> {profile.gold}
          </span>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#888'
        }}>
          <span>PROGRESS</span>
          <span>{profile.avatar_level * 10}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '12px',
            background: '#0a0a0a',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #3a3a3a'
          }}
        >
          <div
            style={{
              width: `${(profile.avatar_level / 10) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${getAvatarColor(profile.avatar_level)} 0%, ${getAvatarColor(profile.avatar_level)}dd 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 10px ${getAvatarColor(profile.avatar_level)}`
            }}
          />
        </div>
      </div>
    </div>
  )
}

