'use client'

import { useEffect, useRef } from 'react'

interface ItemStealAnimationProps {
  isOpen: boolean
  result: 'success' | 'failure'
  targetAvatar: string
  targetName: string
  itemName: string
  worth: number
  onComplete: () => void
}

export default function ItemStealAnimation({
  isOpen,
  result,
  targetAvatar,
  targetName,
  itemName,
  worth,
  onComplete,
}: ItemStealAnimationProps) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => onCompleteRef.current(), 4200)
    return () => clearTimeout(t)
    // Intentionally only depend on isOpen — onComplete is read through a ref
    // so parent re-renders (e.g. the per-second countdown tick) don't reset
    // the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const win = result === 'success'
  const accent = win ? '#1abc9c' : '#ff4444'
  const accentGlow = win ? 'rgba(26, 188, 156, 0.8)' : 'rgba(255, 68, 68, 0.8)'

  // Pre-compute 14 sparkle/alarm "particle" positions/timings so JSX stays clean.
  const sparks = Array.from({ length: 14 }).map((_, i) => {
    const angle = (i / 14) * Math.PI * 2
    const dist = 220 + (i % 3) * 40
    return {
      key: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist,
      delay: 1.6 + (i % 5) * 0.05,
      rot: (i * 47) % 360,
    }
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        animation: 'is-fade-in 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes is-fade-in { from { opacity: 0 } to { opacity: 1 } }

        /* Avatar zooms in, jitters during the snatch, then either glows teal or shakes red */
        @keyframes is-avatar {
          0% { transform: scale(0.4) rotate(-8deg); opacity: 0; filter: brightness(0.4) blur(4px); }
          15% { transform: scale(1.05); opacity: 1; filter: brightness(1) blur(0); }
          30% { transform: scale(1) translateX(0); }
          40% { transform: scale(1) translateX(-6px) rotate(-1deg); }
          45% { transform: scale(1) translateX(6px) rotate(1deg); }
          50% { transform: scale(1) translateX(-4px); }
          55% { transform: scale(1) translateX(0); }
          70% { transform: scale(1.08); filter: brightness(1.4); }
          100% { transform: scale(1); filter: brightness(1); }
        }

        /* Ninja sneaks in from the side */
        @keyframes is-ninja {
          0% { transform: translate(-180%, -50%) rotate(-20deg) scale(0.4); opacity: 0; }
          12% { transform: translate(-60%, -50%) rotate(0deg) scale(1.2); opacity: 1; }
          18% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          58% { transform: translate(-50%, -50%) rotate(-8deg) scale(1.1); opacity: 1; }
          75% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          90% { transform: translate(140%, -50%) rotate(20deg) scale(0.8); opacity: 0; }
          100% { transform: translate(180%, -50%) rotate(30deg) scale(0.4); opacity: 0; }
        }

        /* Snatch flash */
        @keyframes is-flash {
          0%, 55% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
          70% { opacity: 0.5; transform: translate(-50%, -50%) scale(2); }
          80%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(3); }
        }

        /* The stolen item flies toward the thief (success) or stays put */
        @keyframes is-loot {
          0%, 55% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          62% { transform: translate(-50%, -50%) scale(1.3) rotate(-12deg); opacity: 1; }
          75% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          90% { transform: translate(-50%, 60px) scale(0.7) rotate(20deg); opacity: 1; }
          100% { transform: translate(-50%, 140px) scale(0.4) rotate(40deg); opacity: 0; }
        }

        /* Sparkles / alarms burst outward then fade */
        @keyframes is-spark {
          0%, 55% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
          60% { transform: translate(0, 0) scale(0.5) rotate(45deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.2) rotate(var(--final-rot)); opacity: 0; }
        }

        /* Result label slams in */
        @keyframes is-result {
          0%, 76% { opacity: 0; transform: scale(0.3); }
          82% { opacity: 1; transform: scale(1.4); }
          88% { transform: scale(0.95); }
          94% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes is-stage-text {
          0% { opacity: 0; transform: translateY(20px); letter-spacing: 0px; }
          10% { opacity: 1; transform: translateY(0); letter-spacing: 4px; }
          38% { opacity: 1; }
          46% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 0; }
        }
        @keyframes is-stage-text-2 {
          0%, 48% { opacity: 0; transform: translateY(20px); }
          58% { opacity: 1; transform: translateY(0); letter-spacing: 4px; }
          70% { opacity: 1; }
          75% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 0; }
        }

        @keyframes is-shake {
          0%, 100% { transform: translate(0, 0); }
          40% { transform: translate(-3px, 2px); }
          45% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, -3px); }
          55% { transform: translate(2px, 3px); }
          60% { transform: translate(0, 0); }
        }

        @keyframes is-siren {
          0%, 100% { background: rgba(255, 68, 68, 0); }
          60%, 80% { background: rgba(255, 68, 68, 0.25); }
          70% { background: rgba(255, 153, 0, 0.25); }
        }
      `}</style>

      {/* Siren overlay on failure (caught!) */}
      {!win && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'is-siren 4s ease-in-out' }} />
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
          animation: 'is-shake 4s ease-in-out',
        }}
      >
        {/* Target avatar with sneaking ninja */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          {/* Snatch flash behind avatar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
              animation: 'is-flash 4s ease-in-out',
              pointerEvents: 'none',
            }}
          />
          <img
            src={targetAvatar}
            alt={targetName}
            style={{
              width: 220,
              height: 220,
              objectFit: 'cover',
              borderRadius: 20,
              border: `4px solid ${accent}`,
              boxShadow: `0 0 40px ${accentGlow}, 0 0 80px ${accentGlow}`,
              position: 'relative',
              zIndex: 1,
              animation: 'is-avatar 4s ease-in-out',
            }}
          />
          {/* The stolen item, popping out on success */}
          {win && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                fontSize: 90,
                filter: `drop-shadow(0 0 16px ${accentGlow})`,
                animation: 'is-loot 4s ease-in-out',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >💎</div>
          )}
          {/* Sneaking ninja */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              fontSize: 110,
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.9))',
              animation: 'is-ninja 4s ease-in-out',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >🥷</div>
        </div>

        {/* Sparkles / alarm particles bursting outward */}
        <div style={{ position: 'absolute', top: '40%', left: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 3 }}>
          {sparks.map((c) => (
            <div
              key={c.key}
              style={{
                position: 'absolute',
                fontSize: 40,
                transform: 'translate(0,0)',
                animation: `is-spark 4s ease-out ${c.delay}s both`,
                ['--tx' as any]: `${c.tx}px`,
                ['--ty' as any]: `${c.ty}px`,
                ['--final-rot' as any]: `${c.rot}deg`,
                filter: `drop-shadow(0 0 12px ${accentGlow})`,
              } as React.CSSProperties}
            >
              {win ? '✨' : '🚨'}
            </div>
          ))}
        </div>

        {/* Stage text */}
        <div style={{ position: 'relative', minHeight: 50, width: '100%' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              color: '#1abc9c',
              fontSize: 22,
              fontWeight: 800,
              textShadow: '0 0 16px rgba(26, 188, 156, 0.8)',
              animation: 'is-stage-text 4s ease-in-out',
            }}
          >🎯 MARK SPOTTED</div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              color: '#ffd700',
              fontSize: 22,
              fontWeight: 800,
              textShadow: '0 0 16px rgba(255, 215, 0, 0.8)',
              animation: 'is-stage-text-2 4s ease-in-out',
            }}
          >🥷 SNATCHING THE LOOT...</div>
        </div>

        {/* Target name + targeted item */}
        <div
          style={{
            color: accent,
            fontSize: 24,
            fontWeight: 800,
            textShadow: `0 0 20px ${accentGlow}`,
            letterSpacing: 2,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {targetName}
          <div style={{ color: '#ccc', fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'none', marginTop: 4 }}>
            {itemName}
          </div>
        </div>

        {/* Result */}
        <div
          style={{
            color: accent,
            fontSize: 40,
            fontWeight: 900,
            textShadow: `0 0 24px ${accentGlow}, 0 0 48px ${accentGlow}`,
            letterSpacing: 3,
            textAlign: 'center',
            animation: 'is-result 4s ease-out both',
          }}
        >
          {win ? `STOLE ${itemName.toUpperCase()}!` : `CAUGHT! −${worth}g`}
        </div>
      </div>
    </div>
  )
}
