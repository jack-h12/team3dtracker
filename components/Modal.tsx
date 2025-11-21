'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel'
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (type === 'confirm') {
        // Don't close on backdrop click for confirm dialogs
        return
      }
      onClose()
    }
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bg: 'linear-gradient(135deg, #1a3a1a 0%, #0f1f0f 100%)',
          border: '#4caf50',
          glow: 'rgba(76, 175, 80, 0.3)',
          titleColor: '#4caf50'
        }
      case 'warning':
        return {
          icon: '⚠️',
          bg: 'linear-gradient(135deg, #3a2a1a 0%, #1f150f 100%)',
          border: '#ffd700',
          glow: 'rgba(255, 215, 0, 0.3)',
          titleColor: '#ffd700'
        }
      case 'error':
        return {
          icon: '❌',
          bg: 'linear-gradient(135deg, #3a1a1a 0%, #1f0f0f 100%)',
          border: '#ff4444',
          glow: 'rgba(255, 68, 68, 0.3)',
          titleColor: '#ff4444'
        }
      case 'confirm':
        return {
          icon: '❓',
          bg: 'linear-gradient(135deg, #1a1a3a 0%, #0f0f1f 100%)',
          border: '#4a9eff',
          glow: 'rgba(74, 158, 255, 0.3)',
          titleColor: '#4a9eff'
        }
      default:
        return {
          icon: 'ℹ️',
          bg: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
          border: '#00d4ff',
          glow: 'rgba(0, 212, 255, 0.3)',
          titleColor: '#00d4ff'
        }
    }
  }

  const styles = getTypeStyles()

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: styles.bg,
          border: `2px solid ${styles.border}`,
          borderRadius: '20px',
          padding: 'clamp(20px, 4vw, 30px)',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: `0 8px 40px ${styles.glow}`,
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '40px' }}>{styles.icon}</span>
          <h3 style={{
            fontSize: 'clamp(18px, 4vw, 24px)',
            fontWeight: 800,
            color: styles.titleColor,
            margin: 0,
            letterSpacing: '-0.5px',
            flex: 1
          }}>
            {title}
          </h3>
          {type !== 'confirm' && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#888'
              }}
            >
              ×
            </button>
          )}
        </div>
        
        <p style={{
          color: '#ccc',
          fontSize: 'clamp(14px, 3.5vw, 16px)',
          lineHeight: '1.6',
          fontWeight: 500,
          margin: '0 0 25px 0'
        }}>
          {message}
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: type === 'confirm' ? 'space-between' : 'flex-end'
        }}>
          {type === 'confirm' && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '15px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
                e.currentTarget.style.borderColor = '#ff6b35'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                e.currentTarget.style.borderColor = '#3a3a3a'
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={type === 'confirm' ? handleConfirm : onClose}
            style={{
              flex: type === 'confirm' ? 1 : 'none',
              padding: '14px 24px',
              background: type === 'confirm'
                ? `linear-gradient(135deg, ${styles.titleColor} 0%, ${styles.border} 100%)`
                : type === 'error'
                ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)'
                : type === 'success'
                ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              transition: 'all 0.3s ease',
              boxShadow: `0 4px 15px ${styles.glow}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = `0 6px 20px ${styles.glow}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 15px ${styles.glow}`
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

