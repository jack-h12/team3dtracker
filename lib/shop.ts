/**
 * Shop Utilities
 * 
 * Functions for shop interactions:
 * - getShopItems: Fetches all available shop items
 * - purchaseItem: Buys an item and adds it to user inventory
 * - getUserInventory: Gets all items in user's inventory
 * - useItem: Applies item effects (weapons reduce exp, armour protects, potions give immunity)
 * 
 * Item types:
 * - weapon: Can reduce other players' lifetime_exp
 * - armour: Protects from attacks
 * - potion: Gives 24h immunity from attacks
 * - pet: Companion pets
 */

import { supabase } from './supabase'
import type { ShopItem, UserInventory, Profile } from './supabase'

export async function getShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .order('cost', { ascending: true })

  if (error) throw error
  return data || []
}

export async function purchaseItem(userId: string, itemId: string): Promise<void> {
  // Get item details
  const { data: item, error: itemError } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (itemError) throw itemError

  // Type assertion
  const typedItem = item as ShopItem

  // Check if item is restricted (weapon or name_change)
  const isRestricted = typedItem.type === 'weapon' || typedItem.type === 'name_change'
  
  if (isRestricted) {
    // Check if user has elite status (first 3 to complete all tasks)
    const { canPurchaseRestrictedItem } = await import('./elite')
    const canPurchase = await canPurchaseRestrictedItem(userId)
    
    if (!canPurchase) {
      throw new Error('Only the first 3 users who complete all 10 tasks can purchase this item!')
    }
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError

  // Type assertion
  const typedProfile = profile as Profile

  // Check if user has enough gold
  if (typedProfile.gold < typedItem.cost) {
    throw new Error('Not enough gold')
  }

  // Deduct gold
  const { error: goldError } = await ((supabase
    .from('profiles') as any)
    .update({ gold: typedProfile.gold - typedItem.cost })
    .eq('id', userId))

  if (goldError) throw goldError

  // Add to inventory (or increment quantity if exists)
  const { data: existing } = await supabase
    .from('user_inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .single()

  // Set expiration date for armour items (2 weeks from now)
  let expiresAt: string | null = null
  if (typedItem.type === 'armour') {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 14) // 2 weeks = 14 days
    expiresAt = expirationDate.toISOString()
  }

  if (existing) {
    const typedExisting = existing as UserInventory
    // Update quantity and refresh expiration date if it's armour (each purchase resets expiration)
    const updateData: any = { quantity: typedExisting.quantity + 1 }
    if (typedItem.type === 'armour') {
      updateData.expires_at = expiresAt
    }
    
    const { error: updateError } = await ((supabase
      .from('user_inventory') as any)
      .update(updateData)
      .eq('id', typedExisting.id))

    if (updateError) throw updateError
  } else {
    const { error: insertError } = await ((supabase
      .from('user_inventory') as any)
      .insert({
        user_id: userId,
        item_id: itemId,
        quantity: 1,
        expires_at: expiresAt, // null for non-armour items
      }))

    if (insertError) throw insertError
  }
}

export async function getUserInventory(userId: string): Promise<(UserInventory & { item: ShopItem })[]> {
  const { data, error } = await supabase
    .from('user_inventory')
    .select(`
      *,
      item:shop_items(*)
    `)
    .eq('user_id', userId)

  if (error) throw error
  return data?.map((inv: any) => ({
    ...inv,
    item: inv.item[0] || inv.item,
  })) || []
}

export async function useItem(userId: string, inventoryId: string, targetUserId?: string, customName?: string): Promise<void> {
  // Get inventory item
  const { data: inventory, error: invError } = await supabase
    .from('user_inventory')
    .select(`
      *,
      item:shop_items(*)
    `)
    .eq('id', inventoryId)
    .single()

  if (invError) throw invError

  // Handle Supabase join result (can be array or object)
  const itemData = (inventory as any).item
  const item = Array.isArray(itemData) ? itemData[0] : itemData
  if (!item) throw new Error('Item not found')
  
  const typedItem = item as ShopItem

  // Apply item effects
  if (typedItem.type === 'weapon' && targetUserId) {
    // Get target's profile and inventory
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (targetProfile) {
      const typedTargetProfile = targetProfile as Profile
      // Check if target has active potion immunity
      if (typedTargetProfile.potion_immunity_expires) {
        const expirationTime = new Date(typedTargetProfile.potion_immunity_expires)
        if (expirationTime > new Date()) {
          throw new Error('Target is protected by a potion! Immunity is still active.')
        }
      }
      
      // Get weapon damage from effect
      const weaponDamage = getWeaponDamage(typedItem.effect)
      // Check if target has armour equipped
      const { data: targetInventory } = await supabase
        .from('user_inventory')
        .select(`
          *,
          item:shop_items(*)
        `)
        .eq('user_id', targetUserId)

      let maxProtection = 0
      if (targetInventory) {
        // Find armour items and get the highest protection value (protection doesn't stack)
        // Only count armour that hasn't expired (2 weeks from purchase)
        for (const inv of targetInventory as any[]) {
          const invItem = Array.isArray(inv.item) ? inv.item[0] : inv.item
          if (invItem && (invItem as ShopItem).type === 'armour') {
            // Check if armour is expired
            const expiresAt = (inv as UserInventory).expires_at
            if (expiresAt) {
              const expirationDate = new Date(expiresAt)
              const now = new Date()
              if (expirationDate <= now) {
                // Armour has expired, skip it
                continue
              }
            }
            const protection = getProtectionValue((invItem as ShopItem).effect)
            maxProtection = Math.max(maxProtection, protection)
          }
        }
      }

      // Calculate actual damage (weapon damage - highest protection, minimum 0)
      // Only the highest protection armour piece counts (doesn't stack)
      const actualDamage = Math.max(0, weaponDamage - maxProtection)
      const newExp = Math.max(0, typedTargetProfile.lifetime_exp - actualDamage)
      
      // Use database function to update target EXP (bypasses RLS)
      const { error: expUpdateError } = await (supabase.rpc as any)('update_target_exp', {
        target_user_id: targetUserId,
        new_exp: newExp
      })
      
      if (expUpdateError) {
        // Fallback to direct update if function doesn't exist (may fail due to RLS)
        console.warn('Database function not available, trying direct update:', expUpdateError)
        const { error: directUpdateError } = await ((supabase
          .from('profiles') as any)
          .update({ lifetime_exp: newExp })
          .eq('id', targetUserId))
        
        if (directUpdateError) {
          console.error('Error updating target EXP:', directUpdateError)
          throw new Error(`Failed to attack: ${directUpdateError.message}. Please run fix-attack-and-gold-rls.sql in Supabase SQL Editor.`)
        }
      }
    }
  } else if (typedItem.type === 'potion') {
    // Potion gives immunity - set expiration time
    const potionName = typedItem.name.toLowerCase()
    let hours = 24 // Default for Health Potion
    
    if (potionName.includes('super')) {
      hours = 48 // Super Potion
    }
    
    const expirationTime = new Date()
    expirationTime.setHours(expirationTime.getHours() + hours)
    
    // Update user's potion immunity expiration
    await ((supabase
      .from('profiles') as any)
      .update({ potion_immunity_expires: expirationTime.toISOString() })
      .eq('id', userId))
  } else if (typedItem.type === 'name_change' && targetUserId && customName) {
    // Change target's display name using database function (bypasses RLS)
    const { error: nameError } = await (supabase.rpc as any)('change_display_name', {
      target_user_id: targetUserId,
      new_display_name: customName.trim(),
      changed_by_user_id: userId
    })

    if (nameError) {
      console.error('Error updating display name:', nameError)
      throw new Error(`Failed to change name: ${nameError.message}`)
    }
  } else if (typedItem.type === 'name_restore') {
    // Restore user's own name using database function (bypasses RLS)
    const { error: restoreError } = await (supabase.rpc as any)('restore_display_name', {
      user_id_to_restore: userId
    })

    if (restoreError) {
      console.error('Error restoring display name:', restoreError)
      throw new Error(`Failed to restore name: ${restoreError.message}`)
    }
  }

  // Consume item (reduce quantity)
  const typedInventory = inventory as any
  if (typedInventory.quantity > 1) {
    await ((supabase
      .from('user_inventory') as any)
      .update({ quantity: typedInventory.quantity - 1 })
      .eq('id', inventoryId))
  } else {
    await supabase
      .from('user_inventory')
      .delete()
      .eq('id', inventoryId)
  }
}

// Helper function to get effect description from JSONB or string
export function getEffectDescription(effect: string | { description: string; protection?: number; damage?: number }): string {
  if (typeof effect === 'string') {
    // Try to parse as JSON, fallback to string
    try {
      const parsed = JSON.parse(effect)
      return parsed.description || effect
    } catch {
      return effect
    }
  }
  return effect.description || String(effect)
}

// Helper function to get protection value from armour effect
export function getProtectionValue(effect: string | { description: string; protection?: number }): number {
  if (typeof effect === 'string') {
    try {
      const parsed = JSON.parse(effect)
      return parsed.protection || 0
    } catch {
      return 0
    }
  }
  return effect.protection || 0
}

// Helper function to get damage value from weapon effect
export function getWeaponDamage(effect: string | { description: string; damage?: number }): number {
  if (typeof effect === 'string') {
    try {
      const parsed = JSON.parse(effect)
      return parsed.damage || 10 // Default damage
    } catch {
      return 10
    }
  }
  return effect.damage || 10
}

