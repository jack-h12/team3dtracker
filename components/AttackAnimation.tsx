'use client'

import { useEffect } from 'react'

interface AttackAnimationProps {
  isOpen: boolean
  targetAvatar: string
  targetName: string
  swordImage: string
  onComplete: () => void
}

export default function AttackAnimation({
  isOpen,
  targetAvatar,
  targetName,
  swordImage,
  onComplete
}: AttackAnimationProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onComplete()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onComplete])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes swordStab1 {
          /* From left side - straight horizontal line from left to center */
          0% { transform: translate(-250px, 0px) rotate(-45deg) scale(0.5); opacity: 0; }
          8% { transform: translate(75px, 0px) rotate(-45deg) scale(1.4); opacity: 1; }
          12% { transform: translate(90px, 0px) rotate(-45deg) scale(1.2); opacity: 0.9; }
          20% { transform: translate(-230px, 0px) rotate(-45deg) scale(0.6); opacity: 0; }
          20.01% { transform: translate(-250px, 0px) rotate(-45deg) scale(0.5); opacity: 0; }
          100% { transform: translate(-250px, 0px) rotate(-45deg) scale(0.5); opacity: 0; }
        }
        @keyframes swordStab2 {
          /* From right side - straight horizontal line from right to center */
          0% { transform: translate(250px, 0px) rotate(135deg) scale(0.5); opacity: 0; }
          25% { transform: translate(250px, 0px) rotate(135deg) scale(0.5); opacity: 0; }
          33% { transform: translate(-75px, 0px) rotate(135deg) scale(1.4); opacity: 1; }
          37% { transform: translate(-90px, 0px) rotate(135deg) scale(1.2); opacity: 0.9; }
          45% { transform: translate(230px, 0px) rotate(135deg) scale(0.6); opacity: 0; }
          45.01% { transform: translate(250px, 0px) rotate(135deg) scale(0.5); opacity: 0; }
          100% { transform: translate(250px, 0px) rotate(135deg) scale(0.5); opacity: 0; }
        }
        @keyframes swordStab3 {
          /* From top - straight vertical line from top to center */
          0% { transform: translate(0px, -250px) rotate(-135deg) scale(0.5); opacity: 0; }
          50% { transform: translate(0px, -250px) rotate(-135deg) scale(0.5); opacity: 0; }
          58% { transform: translate(0px, 75px) rotate(-135deg) scale(1.5); opacity: 1; }
          62% { transform: translate(0px, 90px) rotate(-135deg) scale(1.3); opacity: 0.9; }
          70% { transform: translate(0px, -230px) rotate(-135deg) scale(0.6); opacity: 0; }
          70.01% { transform: translate(0px, -250px) rotate(-135deg) scale(0.5); opacity: 0; }
          100% { transform: translate(0px, -250px) rotate(-135deg) scale(0.5); opacity: 0; }
        }
        @keyframes swordStab4 {
          /* From bottom-left - straight diagonal line from bottom-left to center */
          0% { transform: translate(-200px, 200px) rotate(-45deg) scale(0.5); opacity: 0; }
          70% { transform: translate(-200px, 200px) rotate(-45deg) scale(0.5); opacity: 0; }
          78% { transform: translate(70px, -70px) rotate(-45deg) scale(1.4); opacity: 1; }
          82% { transform: translate(85px, -85px) rotate(-45deg) scale(1.2); opacity: 0.9; }
          90% { transform: translate(-180px, 180px) rotate(-45deg) scale(0.6); opacity: 0; }
          90.01% { transform: translate(-200px, 200px) rotate(-45deg) scale(0.5); opacity: 0; }
          100% { transform: translate(-200px, 200px) rotate(-45deg) scale(0.5); opacity: 0; }
        }
        @keyframes avatarHit {
          0%, 100% { transform: translateX(0) scale(1); filter: brightness(1); }
          8% { transform: translateX(8px) scale(1.08) rotate(2deg); filter: brightness(1.8); }
          12% { transform: translateX(-5px) scale(0.92) rotate(-1deg); filter: brightness(1); }
          20% { transform: translateX(0) scale(1); filter: brightness(1); }
          33% { transform: translateX(-8px) scale(1.08) rotate(-2deg); filter: brightness(1.8); }
          37% { transform: translateX(5px) scale(0.92) rotate(1deg); filter: brightness(1); }
          45% { transform: translateX(0) scale(1); filter: brightness(1); }
          58% { transform: translateX(0) scale(1.1) rotate(0deg); filter: brightness(2); }
          62% { transform: translateX(0) scale(0.9) rotate(0deg); filter: brightness(1); }
          70% { transform: translateX(0) scale(1); filter: brightness(1); }
          78% { transform: translateX(6px) scale(1.06) rotate(1.5deg); filter: brightness(1.7); }
          82% { transform: translateX(-4px) scale(0.94) rotate(-1deg); filter: brightness(1); }
          90% { transform: translateX(0) scale(1); filter: brightness(1); }
        }
        @keyframes flash {
          0%, 100% { opacity: 0; }
          8% { opacity: 1; }
          12% { opacity: 0; }
          33% { opacity: 1; }
          37% { opacity: 0; }
          58% { opacity: 1; }
          62% { opacity: 0; }
          78% { opacity: 1; }
          82% { opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          8% { transform: translate(8px, 6px) rotate(1deg); }
          12% { transform: translate(-5px, -4px) rotate(-0.5deg); }
          20% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-8px, 6px) rotate(-1deg); }
          37% { transform: translate(5px, -4px) rotate(0.5deg); }
          45% { transform: translate(0, 0) rotate(0deg); }
          58% { transform: translate(0, 8px) rotate(0deg); }
          62% { transform: translate(0, -6px) rotate(0deg); }
          70% { transform: translate(0, 0) rotate(0deg); }
          78% { transform: translate(6px, 5px) rotate(0.8deg); }
          82% { transform: translate(-4px, -3px) rotate(-0.4deg); }
          90% { transform: translate(0, 0) rotate(0deg); }
        }
        .attack-container {
          animation: shake 3s ease-in-out;
        }
      `}</style>
      
      <div
        className="attack-container"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '40px'
        }}
      >
        {/* Target Avatar */}
        <div
          style={{
            position: 'relative',
            animation: 'avatarHit 3s ease-in-out'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(255, 68, 68, 0.3) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'flash 3s ease-in-out',
              pointerEvents: 'none'
            }}
          />
          <img
            src={targetAvatar}
            alt={targetName}
            style={{
              width: '200px',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '20px',
              border: '4px solid #ff4444',
              boxShadow: '0 0 40px rgba(255, 68, 68, 0.8), 0 0 80px rgba(255, 68, 68, 0.4)',
              position: 'relative',
              zIndex: 1
            }}
          />
        </div>

        {/* Sword Animations - Multiple Stabs */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '150px',
            height: '150px',
            pointerEvents: 'none',
            zIndex: 2
          }}
        >
          {/* Stab 1 - From top-left */}
          <img
            src={swordImage}
            alt="Sword"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(255, 68, 68, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))',
              animation: 'swordStab1 3s ease-in-out',
              transformOrigin: '100% 0%' // Top-right corner (sword tip)
            }}
          />
          {/* Stab 2 - From top-right */}
          <img
            src={swordImage}
            alt="Sword"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(255, 68, 68, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))',
              animation: 'swordStab2 3s ease-in-out',
              transformOrigin: '100% 0%' // Top-right corner (sword tip)
            }}
          />
          {/* Stab 3 - From top */}
          <img
            src={swordImage}
            alt="Sword"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(255, 68, 68, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))',
              animation: 'swordStab3 3s ease-in-out',
              transformOrigin: '100% 0%' // Top-right corner (sword tip)
            }}
          />
          {/* Stab 4 - From bottom-left */}
          <img
            src={swordImage}
            alt="Sword"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(255, 68, 68, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))',
              animation: 'swordStab4 3s ease-in-out',
              transformOrigin: '100% 0%' // Top-right corner (sword tip)
            }}
          />
        </div>

        {/* Target Name */}
        <div
          style={{
            color: '#ff4444',
            fontSize: '28px',
            fontWeight: 800,
            textShadow: '0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 68, 68, 0.4)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            animation: 'shake 3s ease-in-out'
          }}
        >
          {targetName}
        </div>

        {/* Damage Text */}
        <div
          style={{
            color: '#ffd700',
            fontSize: '36px',
            fontWeight: 900,
            textShadow: '0 0 20px rgba(255, 215, 0, 1), 0 0 40px rgba(255, 215, 0, 0.6)',
            letterSpacing: '3px',
            animation: 'fadeIn 0.5s ease-out 0.5s both'
          }}
        >
          ⚔️ ATTACK! ⚔️
        </div>
      </div>

      {/* Auto-close after animation */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            setTimeout(() => {
              if (typeof onComplete === 'function') {
                onComplete();
              }
            }, 1500);
          `
        }}
      />
    </div>
  )
}

