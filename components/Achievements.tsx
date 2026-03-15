/**
 * Achievements Component
 * 
 * Displays user achievements:
 * - Achievement gallery with all achievements
 * - Shows unlocked vs locked achievements
 * - Achievement categories
 * - Achievement details and progress
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAchievements, getUserAchievements, type Achievement, type UserAchievement } from '@/lib/achievements'
import { withRetry, wasTabRecentlyHidden } from '@/lib/supabase-helpers'
import { showModal } from '@/lib/modal'

interface AchievementsProps {
  userId: string
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b'
}

const RARITY_NAMES: Record<string, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary'
}

export default function Achievements({ userId }: AchievementsProps) {
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const isLoadingRef = useRef(false)

  const loadData = useCallback(async (silent: boolean = false) => {
    if (isLoadingRef.current) return
    if (!mountedRef.current) return

    isLoadingRef.current = true
    if (!silent) setLoading(true)

    try {
      const [achievements, unlocked] = await Promise.all([
        withRetry(({ signal }) => getAchievements(signal), { maxRetries: 3, timeout: 15000 }),
        withRetry(({ signal }) => getUserAchievements(userId, signal), { maxRetries: 3, timeout: 15000 })
      ])

      if (mountedRef.current) {
        setAllAchievements(achievements)
        setUserAchievements(unlocked)
      }
    } catch (err) {
      console.error('Error loading achievements:', err)
    } finally {
      isLoadingRef.current = false
      if (mountedRef.current && !silent) {
        setLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    mountedRef.current = true

    // Initialize and load data
    const initializeAndLoad = async () => {
      if (wasTabRecentlyHidden()) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      if (mountedRef.current) {
        loadData()
      }
    }

    initializeAndLoad()

    // Check for pending achievements to show notification
    const checkPendingAchievements = () => {
      if (typeof window === 'undefined') return
      const pending = JSON.parse(localStorage.getItem('pending_achievements') || '[]')
      if (pending.length > 0) {
        localStorage.removeItem('pending_achievements')
        // Reload achievements to show newly unlocked ones
        loadData(true)
        // Show notification
        showModal(
          'Achievement Unlocked!',
          `You've unlocked ${pending.length} new achievement${pending.length > 1 ? 's' : ''}! 🎉`,
          'success'
        )
      }
    }

    // Check on mount and periodically
    checkPendingAchievements()
    const interval = setInterval(checkPendingAchievements, 2000)

    // Refresh data when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.hidden || !mountedRef.current) return

      await new Promise(resolve => setTimeout(resolve, 500))

      if (mountedRef.current && !document.hidden) {
        isLoadingRef.current = false
        loadData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadData])

  const isUnlocked = useCallback((achievementCode: string): boolean => {
    return userAchievements.some(ua => ua.achievement.code === achievementCode)
  }, [userAchievements])

  const getUnlockedCount = useCallback((category: string): number => {
    if (category === 'all') {
      return userAchievements.length
    }
    return userAchievements.filter(ua => ua.achievement.category === category).length
  }, [userAchievements])

  const getTotalCount = useCallback((category: string): number => {
    if (category === 'all') {
      return allAchievements.length
    }
    return allAchievements.filter(a => a.category === category).length
  }, [allAchievements])

  const filteredAchievements = selectedCategory === 'all'
    ? allAchievements
    : allAchievements.filter(a => a.category === selectedCategory)

  const categories = ['all', 'tasks', 'exp', 'combat', 'social', 'shop', 'streak', 'special']

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #2a2a2a',
          borderTop: '4px solid #ff6b35',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }} />
        <p style={{ color: '#888', fontSize: '14px' }}>Loading achievements...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>ACHIEVEMENTS</h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          {userAchievements.length} / {allAchievements.length} unlocked
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '25px',
        flexWrap: 'wrap'
      }}>
        {categories.map(category => {
          const count = getUnlockedCount(category)
          const total = getTotalCount(category)
          const isActive = selectedCategory === category

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '10px 16px',
                background: isActive
                  ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
                  : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                color: '#fff',
                border: isActive ? '1px solid #ff6b35' : '1px solid #3a3a3a',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                textTransform: 'capitalize',
                transition: 'all 0.3s ease',
                boxShadow: isActive ? '0 4px 12px rgba(255, 107, 53, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#ff6b35'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#3a3a3a'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {category === 'all' ? 'All' : category} ({count}/{total})
            </button>
          )
        })}
      </div>

      {/* Achievements Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {filteredAchievements.map(achievement => {
          const unlocked = isUnlocked(achievement.code)
          const rarityColor = RARITY_COLORS[achievement.rarity] || '#9ca3af'

          return (
            <div
              key={achievement.id}
              style={{
                background: unlocked
                  ? `linear-gradient(135deg, rgba(${rarityColor === '#9ca3af' ? '156, 163, 175' : rarityColor === '#3b82f6' ? '59, 130, 246' : rarityColor === '#a855f7' ? '168, 85, 247' : '245, 158, 11'}, 0.15) 0%, rgba(${rarityColor === '#9ca3af' ? '156, 163, 175' : rarityColor === '#3b82f6' ? '59, 130, 246' : rarityColor === '#a855f7' ? '168, 85, 247' : '245, 158, 11'}, 0.05) 100%)`
                  : 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                border: unlocked
                  ? `2px solid ${rarityColor}`
                  : '2px solid #3a3a3a',
                borderRadius: '12px',
                padding: '20px',
                position: 'relative',
                opacity: unlocked ? 1 : 0.6,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Locked Overlay */}
              {!unlocked && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '20px',
                  opacity: 0.5
                }}>
                  🔒
                </div>
              )}

              {/* Achievement Icon */}
              <div style={{
                fontSize: '48px',
                textAlign: 'center',
                marginBottom: '12px',
                filter: unlocked ? 'none' : 'grayscale(100%)'
              }}>
                {achievement.icon}
              </div>

              {/* Achievement Info */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  color: unlocked ? '#fff' : '#666',
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: '0 0 6px 0'
                }}>
                  {achievement.name}
                </h3>
                <p style={{
                  color: unlocked ? '#aaa' : '#555',
                  fontSize: '13px',
                  margin: '0 0 10px 0',
                  lineHeight: '1.5'
                }}>
                  {achievement.description}
                </p>

                {/* Rarity Badge */}
                <div style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: rarityColor,
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#000',
                  marginTop: '8px'
                }}>
                  {RARITY_NAMES[achievement.rarity]}
                </div>

                {/* Rewards */}
                {(achievement.reward_gold > 0 || achievement.reward_exp > 0) && unlocked && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#ffd700'
                  }}>
                    {achievement.reward_gold > 0 && `💰 +${achievement.reward_gold} gold`}
                    {achievement.reward_gold > 0 && achievement.reward_exp > 0 && ' • '}
                    {achievement.reward_exp > 0 && `⭐ +${achievement.reward_exp} EXP`}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#888',
          fontSize: '14px'
        }}>
          No achievements in this category
        </div>
      )}
    </div>
  )
}

