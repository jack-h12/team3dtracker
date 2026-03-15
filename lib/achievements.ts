/**
 * Achievements System Utilities
 * 
 * Functions for managing achievements:
 * - getAchievements: Fetch all available achievements
 * - getUserAchievements: Get achievements unlocked by a user
 * - checkAndUnlockAchievement: Check if user qualifies and unlock achievement
 * - checkTaskAchievements: Check achievements related to task completion
 * - checkExpAchievements: Check achievements related to EXP milestones
 * - checkCombatAchievements: Check achievements related to combat
 * - checkSocialAchievements: Check achievements related to friends
 * - checkShopAchievements: Check achievements related to purchases
 */

import { supabase } from './supabase'

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  category: 'tasks' | 'exp' | 'combat' | 'social' | 'shop' | 'streak' | 'special'
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  requirement_value: number | null
  requirement_type: string | null
  reward_gold: number
  reward_exp: number
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  unlocked_at: string
  achievement: Achievement
}

/**
 * Get all available achievements
 */
export async function getAchievements(signal?: AbortSignal): Promise<Achievement[]> {
  const query = supabase
    .from('achievements')
    .select('*')
    .order('category', { ascending: true })
    .order('requirement_value', { ascending: true })

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * Get achievements unlocked by a specific user
 */
export async function getUserAchievements(userId: string, signal?: AbortSignal): Promise<UserAchievement[]> {
  const query = supabase
    .from('user_achievements')
    .select(`
      *,
      achievement:achievements(*)
    `)
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Transform the data to flatten the achievement object
  return (data || []).map((ua: any) => ({
    id: ua.id,
    user_id: ua.user_id,
    achievement_id: ua.achievement_id,
    unlocked_at: ua.unlocked_at,
    achievement: ua.achievement
  }))
}

/**
 * Unlock an achievement for a user
 * Returns true if unlocked, false if already unlocked or doesn't exist
 */
export async function unlockAchievement(userId: string, achievementCode: string): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('unlock_achievement', {
    user_id_param: userId,
    achievement_code_param: achievementCode
  })

  if (error) {
    console.error('Error unlocking achievement:', error)
    return false
  }

  return data === true
}

/**
 * Check and unlock task-related achievements
 */
export async function checkTaskAchievements(
  userId: string,
  totalTasksCompleted: number,
  dailyTasksCompleted: number
): Promise<string[]> {
  const unlocked: string[] = []

  // Check total task count achievements
  if (totalTasksCompleted >= 1) {
    if (await unlockAchievement(userId, 'first_task')) unlocked.push('first_task')
  }
  if (totalTasksCompleted >= 10) {
    if (await unlockAchievement(userId, 'task_10')) unlocked.push('task_10')
  }
  if (totalTasksCompleted >= 50) {
    if (await unlockAchievement(userId, 'task_50')) unlocked.push('task_50')
  }
  if (totalTasksCompleted >= 100) {
    if (await unlockAchievement(userId, 'task_100')) unlocked.push('task_100')
  }
  if (totalTasksCompleted >= 500) {
    if (await unlockAchievement(userId, 'task_500')) unlocked.push('task_500')
  }
  if (totalTasksCompleted >= 1000) {
    if (await unlockAchievement(userId, 'task_1000')) unlocked.push('task_1000')
  }

  // Check daily task achievements
  if (dailyTasksCompleted >= 10) {
    if (await unlockAchievement(userId, 'daily_10')) unlocked.push('daily_10')
  }

  return unlocked
}

/**
 * Check and unlock EXP-related achievements
 */
export async function checkExpAchievements(userId: string, lifetimeExp: number): Promise<string[]> {
  const unlocked: string[] = []

  if (lifetimeExp >= 100) {
    if (await unlockAchievement(userId, 'exp_100')) unlocked.push('exp_100')
  }
  if (lifetimeExp >= 500) {
    if (await unlockAchievement(userId, 'exp_500')) unlocked.push('exp_500')
  }
  if (lifetimeExp >= 1000) {
    if (await unlockAchievement(userId, 'exp_1000')) unlocked.push('exp_1000')
  }
  if (lifetimeExp >= 5000) {
    if (await unlockAchievement(userId, 'exp_5000')) unlocked.push('exp_5000')
  }
  if (lifetimeExp >= 10000) {
    if (await unlockAchievement(userId, 'exp_10000')) unlocked.push('exp_10000')
  }
  if (lifetimeExp >= 50000) {
    if (await unlockAchievement(userId, 'exp_50000')) unlocked.push('exp_50000')
  }

  return unlocked
}

/**
 * Check and unlock combat-related achievements
 * Note: This requires tracking attack/defense counts in the database
 */
export async function checkCombatAchievements(
  userId: string,
  attackCount: number,
  defenseCount: number
): Promise<string[]> {
  const unlocked: string[] = []

  if (attackCount >= 1) {
    if (await unlockAchievement(userId, 'first_attack')) unlocked.push('first_attack')
  }
  if (attackCount >= 10) {
    if (await unlockAchievement(userId, 'attack_10')) unlocked.push('attack_10')
  }
  if (attackCount >= 50) {
    if (await unlockAchievement(userId, 'attack_50')) unlocked.push('attack_50')
  }
  if (attackCount >= 100) {
    if (await unlockAchievement(userId, 'attack_100')) unlocked.push('attack_100')
  }

  if (defenseCount >= 10) {
    if (await unlockAchievement(userId, 'survive_10')) unlocked.push('survive_10')
  }
  if (defenseCount >= 50) {
    if (await unlockAchievement(userId, 'survive_50')) unlocked.push('survive_50')
  }

  return unlocked
}

/**
 * Check and unlock social-related achievements
 */
export async function checkSocialAchievements(userId: string, friendCount: number): Promise<string[]> {
  const unlocked: string[] = []

  if (friendCount >= 1) {
    if (await unlockAchievement(userId, 'first_friend')) unlocked.push('first_friend')
  }
  if (friendCount >= 5) {
    if (await unlockAchievement(userId, 'friend_5')) unlocked.push('friend_5')
  }
  if (friendCount >= 10) {
    if (await unlockAchievement(userId, 'friend_10')) unlocked.push('friend_10')
  }
  if (friendCount >= 25) {
    if (await unlockAchievement(userId, 'friend_25')) unlocked.push('friend_25')
  }

  return unlocked
}

/**
 * Check and unlock shop-related achievements
 */
export async function checkShopAchievements(
  userId: string,
  purchaseCount: number,
  weaponTypesOwned: number,
  armourTypesOwned: number
): Promise<string[]> {
  const unlocked: string[] = []

  if (purchaseCount >= 1) {
    if (await unlockAchievement(userId, 'first_purchase')) unlocked.push('first_purchase')
  }
  if (purchaseCount >= 10) {
    if (await unlockAchievement(userId, 'purchase_10')) unlocked.push('purchase_10')
  }
  if (purchaseCount >= 50) {
    if (await unlockAchievement(userId, 'purchase_50')) unlocked.push('purchase_50')
  }
  if (purchaseCount >= 100) {
    if (await unlockAchievement(userId, 'purchase_100')) unlocked.push('purchase_100')
  }

  if (weaponTypesOwned >= 3) {
    if (await unlockAchievement(userId, 'collect_all_weapons')) unlocked.push('collect_all_weapons')
  }
  if (armourTypesOwned >= 3) {
    if (await unlockAchievement(userId, 'collect_all_armour')) unlocked.push('collect_all_armour')
  }

  return unlocked
}

/**
 * Check and unlock special achievements
 */
export async function checkSpecialAchievements(
  userId: string,
  hasEliteStatus: boolean,
  dailyRank: number | null,
  lifetimeRank: number | null
): Promise<string[]> {
  const unlocked: string[] = []

  if (hasEliteStatus) {
    if (await unlockAchievement(userId, 'elite_status')) unlocked.push('elite_status')
  }

  if (dailyRank === 1) {
    if (await unlockAchievement(userId, 'first_place_daily')) unlocked.push('first_place_daily')
  }

  if (lifetimeRank === 1) {
    if (await unlockAchievement(userId, 'first_place_lifetime')) unlocked.push('first_place_lifetime')
  }

  return unlocked
}

/**
 * Get achievement progress for a user
 * Returns a map of achievement codes to their progress percentage
 */
export async function getAchievementProgress(userId: string): Promise<Map<string, number>> {
  const progress = new Map<string, number>()

  // Get user's profile stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('lifetime_exp, tasks_completed_today')
    .eq('id', userId)
    .single()

  if (!profile) return progress

  // Get all achievements
  const achievements = await getAchievements()

  // Calculate progress for each achievement
  for (const achievement of achievements) {
    if (!achievement.requirement_value || !achievement.requirement_type) continue

    let currentValue = 0

    switch (achievement.requirement_type) {
      case 'task_count':
        // Would need to track total tasks completed - for now use a placeholder
        // You'd need to add a total_tasks_completed column to profiles
        break
      case 'exp_total':
        currentValue = profile.lifetime_exp || 0
        break
      case 'daily_task_count':
        currentValue = profile.tasks_completed_today || 0
        break
      // Add more cases as needed
    }

    const percentage = Math.min(100, (currentValue / achievement.requirement_value) * 100)
    progress.set(achievement.code, percentage)
  }

  return progress
}

