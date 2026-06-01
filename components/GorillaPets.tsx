/**
 * GorillaPets Component
 *
 * Renders one gorillagif.gif per pet gorilla a user owns, displayed next to
 * their name in the main menu header and on the leaderboard.
 *
 * Each gorilla shows a frozen first frame of the gif by default (captured onto
 * a <canvas>). Hovering over a gorilla mounts the animated <img>, which
 * restarts the gif from the beginning. Moving the cursor away unmounts the gif
 * and reveals the static first frame again.
 *
 * Use getGorillaCount() to derive the count from a user's inventory.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import type { ShopItem, UserInventory } from '@/lib/supabase'

const GORILLA_GIF = '/gorillagif.gif'

/**
 * Count how many pet gorillas a user owns from their inventory.
 * Pet quantities stack, so a single "Pet Gorilla" row with quantity 3 = 3 gorillas.
 */
export function getGorillaCount(
  inventory: (UserInventory & { item: ShopItem })[] | undefined | null
): number {
  if (!inventory) return 0
  return inventory.reduce((total, inv) => {
    if (inv.item?.type === 'pet' && inv.item.name?.toLowerCase().includes('gorilla')) {
      return total + (inv.quantity || 0)
    }
    return total
  }, 0)
}

function GorillaPet({ size }: { size: number | string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // "active" = animate the gif. Driven by hover on desktop and tap on mobile.
  const [hovered, setHovered] = useState(false)
  const [tapped, setTapped] = useState(false)
  const active = hovered || tapped

  // Capture the first frame of the gif onto the canvas once, so we can show a
  // static "paused" gorilla while not hovering.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const img = new Image()
    img.src = GORILLA_GIF
    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !img.naturalWidth) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
    }

    if (img.complete) {
      draw()
    } else {
      img.onload = draw
    }
  }, [])

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        // On mobile (and trackpads) a tap toggles the animation. Stop the event
        // bubbling so it doesn't trigger the parent row's "view profile" click.
        e.stopPropagation()
        setTapped((prev) => !prev)
      }}
      style={{
        cursor: 'pointer',
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
      title="Pet Gorilla"
    >
      {/* Static first frame (hidden while the gif plays so it can't show through) */}
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: '6px',
          display: 'block',
          visibility: active ? 'hidden' : 'visible',
        }}
      />
      {/* Animated gif while active (mounting fresh restarts the animation) */}
      {active && (
        <img
          src={GORILLA_GIF}
          alt="Pet Gorilla"
          style={{
            position: 'absolute',
            inset: 0,
            width: size,
            height: size,
            objectFit: 'contain',
            borderRadius: '6px',
          }}
        />
      )}
    </span>
  )
}

interface GorillaPetsProps {
  count: number
  size?: number | string
  gap?: number
}

export default function GorillaPets({ count, size = 24, gap = 3 }: GorillaPetsProps) {
  if (!count || count <= 0) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        verticalAlign: 'middle',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <GorillaPet key={i} size={size} />
      ))}
    </span>
  )
}
