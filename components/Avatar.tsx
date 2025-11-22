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

import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { getDisplayName } from '@/lib/supabase'
import { getUserInventory, getWeaponDamage, getProtectionValue } from '@/lib/shop'
import { getAvatarImage, getAvatarColor, getItemImage, getPotionTimeRemaining, getArmourTimeRemaining } from '@/lib/utils'
import type { Profile, ShopItem, UserInventory } from '@/lib/supabase'

interface AvatarProps {
  profile: Profile
  showEquipped?: boolean // Whether to show equipped items on avatar
}

function Avatar({ profile, showEquipped = true }: AvatarProps) {
  const [equippedItems, setEquippedItems] = useState<(UserInventory & { item: ShopItem })[]>([])
  const [showPotionTooltip, setShowPotionTooltip] = useState(false)
  const [showArmourTooltip, setShowArmourTooltip] = useState(false)

  const loadEquippedItems = useCallback(async () => {
    try {
      const inventory = await getUserInventory(profile.id)
      const now = new Date()
      // Get weapons and armor only, filter out expired armour
      const weaponsAndArmor = inventory.filter(inv => {
        if (inv.item.type === 'weapon') return true
        if (inv.item.type === 'armour') {
          // Only include armour that hasn't expired
          if (inv.expires_at) {
            const expirationDate = new Date(inv.expires_at)
            return expirationDate > now
          }
          // If no expiration date, include it (backward compatibility)
          return true
        }
        return false
      })
      setEquippedItems(weaponsAndArmor)
    } catch (err) {
      console.error('Error loading equipped items:', err)
    }
  }, [profile.id])

  useEffect(() => {
    if (showEquipped) {
      loadEquippedItems()
    }
  }, [showEquipped, loadEquippedItems])

  // Find most powerful weapon (highest damage) - memoized
  const topWeapon = useMemo(() => {
    const weapons = equippedItems.filter(inv => inv.item.type === 'weapon')
    return weapons.length > 0 ? weapons.reduce((best, current) => {
      const bestDamage = getWeaponDamage(best.item.effect)
      const currentDamage = getWeaponDamage(current.item.effect)
      return currentDamage > bestDamage ? current : best
    }) : null
  }, [equippedItems])

  // Find most powerful armor (highest protection) - memoized
  // Only count armour that hasn't expired
  const topArmor = useMemo(() => {
    const now = new Date()
    const validArmors = equippedItems.filter(inv => {
      if (inv.item.type !== 'armour') return false
      // Check if armour is expired
      if (inv.expires_at) {
        const expirationDate = new Date(inv.expires_at)
        return expirationDate > now
      }
      // If no expiration date, assume it's still valid (for backward compatibility)
      return true
    })
    
    return validArmors.length > 0 ? validArmors.reduce((best, current) => {
      const bestProtection = getProtectionValue(best.item.effect)
      const currentProtection = getProtectionValue(current.item.effect)
      return currentProtection > bestProtection ? current : best
    }) : null
  }, [equippedItems])
  
  // Calculate armour time remaining for tooltip
  const armourTimeRemaining = useMemo(() => {
    if (!topArmor || !topArmor.expires_at) return ''
    return getArmourTimeRemaining(topArmor.expires_at)
  }, [topArmor])

  // Check if potion is active
  const isPotionActive = useMemo(() => {
    return profile.potion_immunity_expires 
      ? new Date(profile.potion_immunity_expires) > new Date()
      : false
  }, [profile.potion_immunity_expires])
  
  const potionTimeRemaining = useMemo(() => {
    return getPotionTimeRemaining(profile.potion_immunity_expires)
  }, [profile.potion_immunity_expires])

  // Memoize expensive calculations
  const avatarLevel = profile.avatar_level
  const avatarImage = useMemo(() => getAvatarImage(avatarLevel), [avatarLevel])
  const avatarColor = useMemo(() => getAvatarColor(avatarLevel), [avatarLevel])
  const progressWidth = useMemo(() => `${(avatarLevel / 10) * 100}%`, [avatarLevel])
  const progressPercent = useMemo(() => avatarLevel * 10, [avatarLevel])
  const avatarColorWithOpacity = useMemo(() => `${avatarColor}dd`, [avatarColor])

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
          filter: `drop-shadow(0 0 20px ${avatarColor})`,
          position: 'relative'
        }}
      >
        {/* Potion Effect - Top Center */}
        {showEquipped && isPotionActive && (
          <div
            style={{
              position: 'absolute',
              top: '-24px',
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
        )}
        
        {/* Avatar Image */}
        <img
          src={avatarImage}
          alt={`Level ${avatarLevel} avatar`}
          style={{
            width: 'clamp(100px, 20vw, 140px)',
            height: 'clamp(100px, 20vw, 140px)',
            objectFit: 'cover',
            borderRadius: '16px',
            border: `3px solid ${avatarColor}`,
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
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              zIndex: 2,
              cursor: armourTimeRemaining ? 'pointer' : 'default'
            }}
            onMouseEnter={() => armourTimeRemaining && setShowArmourTooltip(true)}
            onMouseLeave={() => setShowArmourTooltip(false)}
          >
            <img
              src={getItemImage(topArmor.item)}
              alt={topArmor.item.name}
              style={{
                width: '40px',
                height: '40px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 8px rgba(74, 158, 255, 0.6))',
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '8px',
                padding: '4px',
                border: '2px solid #4a9eff',
                position: 'relative'
              }}
            />
            {/* Tooltip on hover */}
            {showArmourTooltip && armourTimeRemaining && (
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
          }}>{avatarLevel}/10</span>
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
          <span>{progressPercent}%</span>
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
              width: progressWidth,
              height: '100%',
              background: `linear-gradient(90deg, ${avatarColor} 0%, ${avatarColorWithOpacity} 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 10px ${avatarColor}`
            }}
          />
        </div>
      </div>
    </div>
  )
}

// Memoize component to prevent re-renders when profile object reference changes but values don't
export default memo(Avatar, (prevProps, nextProps) => {
  // Only re-render if these specific values change
  return (
    prevProps.profile.avatar_level === nextProps.profile.avatar_level &&
    prevProps.profile.lifetime_exp === nextProps.profile.lifetime_exp &&
    prevProps.profile.gold === nextProps.profile.gold &&
    prevProps.profile.potion_immunity_expires === nextProps.profile.potion_immunity_expires &&
    prevProps.profile.id === nextProps.profile.id &&
    prevProps.profile.username === nextProps.profile.username &&
    prevProps.profile.display_name === nextProps.profile.display_name &&
    prevProps.showEquipped === nextProps.showEquipped
  )
})

