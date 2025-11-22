/**
 * Shared Utility Functions
 * 
 * Common helper functions used across multiple components to avoid duplication.
 */

/**
 * Get avatar image path based on level (0-10)
 */
export function getAvatarImage(level: number): string {
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

/**
 * Get avatar color based on level
 */
export function getAvatarColor(level: number): string {
  if (level === 0) return '#cccccc'
  if (level <= 2) return '#ffeb3b'
  if (level <= 4) return '#ff9800'
  if (level <= 6) return '#4caf50'
  if (level <= 8) return '#2196f3'
  return '#ff6b35'
}

/**
 * Get item image path based on item type and name
 */
export function getItemImage(item: { type: string; name: string; cost?: number }): string {
  if (item.type === 'weapon') {
    const name = item.name.toLowerCase()
    if (name.includes('wooden')) return '/Wooden Sword.png'
    if (name.includes('iron')) return '/iron sword.webp'
    if (name.includes('diamond')) return '/diamond sword.webp'
    if (item.cost && item.cost <= 50) return '/Wooden Sword.png'
    if (item.cost && item.cost <= 150) return '/iron sword.webp'
    return '/diamond sword.webp'
  } else if (item.type === 'armour') {
    const name = item.name.toLowerCase()
    if (name.includes('leather')) return '/leather armour.png'
    if (name.includes('iron')) return '/iron armour.png'
    if (name.includes('diamond') || name.includes('steel')) return '/diamond armour.webp'
    if (item.cost && item.cost <= 100) return '/leather armour.png'
    if (item.cost && item.cost <= 250) return '/iron armour.png'
    return '/diamond armour.webp'
  } else if (item.type === 'pet') {
    const name = item.name.toLowerCase()
    if (name.includes('gorilla')) {
      return '/pet gorilla.jpg'
    }
    return '🐾'
  } else if (item.type === 'potion') {
    return '🧪'
  } else if (item.type === 'name_change') {
    return '📜'
  } else if (item.type === 'name_restore') {
    return '✨'
  }
  return '📦'
}

/**
 * Get potion time remaining as formatted string
 */
export function getPotionTimeRemaining(expiresAt: string | null | undefined): string {
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

/**
 * Get armour time remaining as formatted string (for 2-week expiration)
 */
export function getArmourTimeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return ''
  const expires = new Date(expiresAt)
  const now = new Date()
  const diff = expires.getTime() - now.getTime()
  
  if (diff <= 0) return 'Expired'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    if (hours > 0) {
      return `${days}d ${hours}h remaining`
    }
    return `${days}d remaining`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  }
  return `${minutes}m remaining`
}

