'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { updatePassword } from '@/lib/auth'

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(true)
  const [exchangeError, setExchangeError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let mounted = true

    const handleCodeExchange = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      // Clean the code from the URL
      if (code) {
        window.history.replaceState({}, '', window.location.pathname)
      }

      if (!code) {
        if (mounted) {
          setExchangeError('No reset code found. Please request a new password reset link.')
          setExchanging(false)
        }
        return
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
      } catch (err: any) {
        console.error('Error exchanging auth code:', err)
        if (mounted) {
          setExchangeError(
            'This reset link has expired or is invalid. Please request a new one.'
          )
        }
      } finally {
        if (mounted) setExchanging(false)
      }
    }

    handleCodeExchange()

    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await updatePassword(newPassword)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  // Shared container styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: '420px',
    width: '100%',
    padding: '35px',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: '1px solid #3a3a3a',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  }

  // Loading state while exchanging the code
  if (exchanging) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #2a2a2a',
            borderTop: '4px solid #ff6b35',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px',
          }}></div>
          <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Verifying reset link...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Exchange failed — show error with link back
  if (exchangeError) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <img
              src="/team3dicon.webp"
              alt="Team3D Logo"
              style={{
                width: '60px', height: '60px', borderRadius: '14px',
                margin: '0 auto 20px', boxShadow: '0 8px 30px rgba(255, 107, 53, 0.4)',
                objectFit: 'cover', display: 'block',
              }}
            />
            <h2 style={{
              fontSize: '24px', fontWeight: 800, margin: '0 0 12px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>LINK EXPIRED</h2>
            <p style={{
              color: '#ff4444', marginBottom: '25px', padding: '14px',
              background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '10px', fontSize: '14px', fontWeight: 500,
            }}>{exchangeError}</p>
            <a
              href="/"
              style={{
                display: 'inline-block', padding: '14px 28px',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontWeight: 700, fontSize: '15px', textDecoration: 'none',
                boxShadow: '0 8px 25px rgba(255, 107, 53, 0.4)',
              }}
            >Back to Login</a>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <img
              src="/team3dicon.webp"
              alt="Team3D Logo"
              style={{
                width: '60px', height: '60px', borderRadius: '14px',
                margin: '0 auto 20px', boxShadow: '0 8px 30px rgba(255, 107, 53, 0.4)',
                objectFit: 'cover', display: 'block',
              }}
            />
            <h2 style={{
              fontSize: '24px', fontWeight: 800, margin: '0 0 12px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #4caf50 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>PASSWORD UPDATED</h2>
            <p style={{
              color: '#4caf50', marginBottom: '25px', padding: '14px',
              background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '10px', fontSize: '14px', fontWeight: 500,
            }}>Your password has been successfully changed. You can now log in with your new password.</p>
            <a
              href="/"
              style={{
                display: 'inline-block', padding: '14px 28px',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontWeight: 700, fontSize: '15px', textDecoration: 'none',
                boxShadow: '0 8px 25px rgba(255, 107, 53, 0.4)',
              }}
            >Go to Login</a>
          </div>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <img
            src="/team3dicon.webp"
            alt="Team3D Logo"
            style={{
              width: '60px', height: '60px', borderRadius: '14px',
              margin: '0 auto 20px', boxShadow: '0 8px 30px rgba(255, 107, 53, 0.4)',
              objectFit: 'cover', display: 'block',
            }}
          />
          <h2 style={{
            fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>SET NEW PASSWORD</h2>
          <p style={{ color: '#888', fontSize: '14px' }}>Enter your new password below</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontWeight: 600, fontSize: '14px' }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                background: '#0a0a0a', border: '1px solid #3a3a3a', borderRadius: '10px',
                color: '#fff', fontSize: '15px', fontWeight: 500,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
              required
              minLength={6}
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontWeight: 600, fontSize: '14px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                background: '#0a0a0a', border: '1px solid #3a3a3a', borderRadius: '10px',
                color: '#fff', fontSize: '15px', fontWeight: 500,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
              required
              minLength={6}
            />
          </div>
          {error && (
            <div style={{
              color: '#ff4444', marginBottom: '20px', padding: '14px',
              background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '10px', fontSize: '14px', fontWeight: 500,
            }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '16px',
              background: loading
                ? 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
                : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
              color: '#fff', border: 'none', borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '16px',
              boxShadow: loading ? 'none' : '0 8px 25px rgba(255, 107, 53, 0.4)',
            }}
          >
            {loading ? 'Updating...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  )
}
