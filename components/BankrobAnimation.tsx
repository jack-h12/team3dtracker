'use client'

import { useEffect, useRef } from 'react'

interface BankrobAnimationProps {
  isOpen: boolean
  result: 'success' | 'failure'
  targetAvatar: string
  targetName: string
  goldAmount: number
  onComplete: () => void
}

export default function BankrobAnimation({
  isOpen,
  result,
  targetAvatar,
  targetName,
  goldAmount,
  onComplete,
}: BankrobAnimationProps) {
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
  const accent = win ? '#4caf50' : '#ff4444'
  const accentGlow = win ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 68, 68, 0.8)'

  // Pre-compute 14 coin "particle" positions/timings so JSX stays clean.
  const coins = Array.from({ length: 14 }).map((_, i) => {
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
        animation: 'br-fade-in 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes br-fade-in { from { opacity: 0 } to { opacity: 1 } }

        /* Avatar zooms in, jitters during cracking, then either glows green or shakes red */
        @keyframes br-avatar {
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

        /* Mask drops in over target */
        @keyframes br-mask {
          0% { transform: translate(-50%, -180%) rotate(-30deg) scale(0.4); opacity: 0; }
          12% { transform: translate(-50%, -60%) rotate(0deg) scale(1.2); opacity: 1; }
          18% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          75% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          90% { transform: translate(-50%, -120%) rotate(20deg) scale(0.8); opacity: 0; }
          100% { transform: translate(-50%, -180%) rotate(30deg) scale(0.4); opacity: 0; }
        }

        /* Vault crack flash */
        @keyframes br-vault-flash {
          0%, 55% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
          70% { opacity: 0.5; transform: translate(-50%, -50%) scale(2); }
          80%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(3); }
        }

        /* Coins burst outward then fade */
        @keyframes br-coin {
          0%, 55% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
          60% { transform: translate(0, 0) scale(0.5) rotate(45deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.2) rotate(var(--final-rot)); opacity: 0; }
        }

        /* Result label slams in */
        @keyframes br-result {
          0%, 76% { opacity: 0; transform: scale(0.3); }
          82% { opacity: 1; transform: scale(1.4); }
          88% { transform: scale(0.95); }
          94% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes br-stage-text {
          0% { opacity: 0; transform: translateY(20px); letter-spacing: 0px; }
          10% { opacity: 1; transform: translateY(0); letter-spacing: 4px; }
          38% { opacity: 1; }
          46% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 0; }
        }
        @keyframes br-stage-text-2 {
          0%, 48% { opacity: 0; transform: translateY(20px); }
          58% { opacity: 1; transform: translateY(0); letter-spacing: 4px; }
          70% { opacity: 1; }
          75% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 0; }
        }

        @keyframes br-shake {
          0%, 100% { transform: translate(0, 0); }
          40% { transform: translate(-3px, 2px); }
          45% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, -3px); }
          55% { transform: translate(2px, 3px); }
          60% { transform: translate(0, 0); }
        }

        @keyframes br-siren {
          0%, 100% { background: rgba(255, 68, 68, 0); }
          60%, 80% { background: rgba(255, 68, 68, 0.25); }
          70% { background: rgba(0, 0, 255, 0.25); }
        }
      `}</style>

      {/* Siren overlay on failure */}
      {!win && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'br-siren 4s ease-in-out' }} />
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
          animation: 'br-shake 4s ease-in-out',
        }}
      >
        {/* Target avatar with mask */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          {/* Vault flash behind avatar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
              animation: 'br-vault-flash 4s ease-in-out',
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
              animation: 'br-avatar 4s ease-in-out',
            }}
          />
          {/* Burglar mask */}
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              fontSize: 110,
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.9))',
              animation: 'br-mask 4s ease-in-out',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >🦹</div>
        </div>

        {/* Coins / siren particles bursting outward */}
        <div style={{ position: 'absolute', top: '40%', left: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 3 }}>
          {coins.map((c) => (
            <div
              key={c.key}
              style={{
                position: 'absolute',
                fontSize: 40,
                transform: 'translate(0,0)',
                animation: `br-coin 4s ease-out ${c.delay}s both`,
                ['--tx' as any]: `${c.tx}px`,
                ['--ty' as any]: `${c.ty}px`,
                ['--final-rot' as any]: `${c.rot}deg`,
                filter: `drop-shadow(0 0 12px ${accentGlow})`,
              } as React.CSSProperties}
            >
              {win ? '💰' : '🚨'}
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
              color: '#9b59b6',
              fontSize: 22,
              fontWeight: 800,
              textShadow: '0 0 16px rgba(155, 89, 182, 0.8)',
              animation: 'br-stage-text 4s ease-in-out',
            }}
          >🎭 TARGET ACQUIRED</div>
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
              animation: 'br-stage-text-2 4s ease-in-out',
            }}
          >🔓 CRACKING THE VAULT...</div>
        </div>

        {/* Target name */}
        <div
          style={{
            color: accent,
            fontSize: 24,
            fontWeight: 800,
            textShadow: `0 0 20px ${accentGlow}`,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >{targetName}</div>

        {/* Result */}
        <div
          style={{
            color: accent,
            fontSize: 44,
            fontWeight: 900,
            textShadow: `0 0 24px ${accentGlow}, 0 0 48px ${accentGlow}`,
            letterSpacing: 3,
            animation: 'br-result 4s ease-out both',
          }}
        >
          {win ? `+${goldAmount}g STOLEN` : `BUSTED! −${goldAmount}g`}
        </div>
      </div>
    </div>
  )
}
