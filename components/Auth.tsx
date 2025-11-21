/**
 * Authentication Component
 * 
 * Handles user signup and login.
 * - Signup: Creates new account with email, password, and username
 * - Login: Authenticates existing users
 * - Automatically creates a profile when user signs up
 * 
 * Uses Supabase auth.signUp() and auth.signInWithPassword() to communicate with Supabase.
 */

'use client'

import { useState } from 'react'
import { signUp, signIn } from '@/lib/auth'

interface AuthProps {
  onAuthSuccess: () => void
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmailVerification, setShowEmailVerification] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await signIn(email, password)
        onAuthSuccess()
      } else {
        if (!username.trim()) {
          setError('Username is required')
          setLoading(false)
          return
        }
        const result = await signUp(email, password, username)
        
        // Check if email confirmation is required
        if (result.user && !result.user.email_confirmed_at) {
          // Email confirmation required
          setShowEmailVerification(true)
          setError('')
          return
        }
        
        // Email already confirmed or confirmation not required
        onAuthSuccess()
      }
    } catch (err: any) {
      // Show more detailed error message
      console.error('Full auth error object:', err)
      console.error('Error message:', err.message)
      console.error('Error code:', err.code)
      console.error('Error details:', err.details)
      console.error('Error hint:', err.hint)
      
      // Try to extract the most helpful error message
      let errorMessage = 'Authentication failed'
      if (err.message) {
        errorMessage = err.message
      } else if (err.error_description) {
        errorMessage = err.error_description
      } else if (err.details) {
        errorMessage = err.details
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      // Show full error in UI for debugging
      setError(`${errorMessage}${err.code ? ` (Code: ${err.code})` : ''}${err.details ? ` - ${err.details}` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        padding: '40px',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <img
            src="/team3dicon.webp"
            alt="Team3D Logo"
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '16px',
              margin: '0 auto 20px',
              boxShadow: '0 8px 30px rgba(255, 107, 53, 0.4)',
              objectFit: 'cover',
              display: 'block'
            }}
          />
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            margin: '0 0 10px 0',
            background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px'
          }}>{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</h2>
          <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>Track your progress, dominate your goals</p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px',
                color: '#ccc',
                fontWeight: 600,
                fontSize: '14px'
              }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  boxSizing: 'border-box',
                  background: '#0a0a0a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 500,
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#ff6b35'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#3a3a3a'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                required
              />
            </div>
          )}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: '#ccc',
              fontWeight: 600,
              fontSize: '14px'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                boxSizing: 'border-box',
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#ff6b35'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3a3a3a'
                e.currentTarget.style.boxShadow = 'none'
              }}
              required
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: '#ccc',
              fontWeight: 600,
              fontSize: '14px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                boxSizing: 'border-box',
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#ff6b35'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3a3a3a'
                e.currentTarget.style.boxShadow = 'none'
              }}
              required
            />
          </div>
          {showEmailVerification && (
            <div style={{
              color: '#4caf50',
              marginBottom: '20px',
              padding: '20px',
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📧</div>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>Check Your Email!</strong>
              <p style={{ margin: '0 0 12px 0', lineHeight: '1.6' }}>
                We've sent a verification email to <strong>{email}</strong>. 
                Please check your inbox and click the verification link to activate your account.
              </p>
              <p style={{ margin: '0', fontSize: '12px', color: '#888' }}>
                After verifying, you can log in with your credentials.
              </p>
            </div>
          )}
          {error && (
            <div style={{
              color: '#ff4444',
              marginBottom: '20px',
              padding: '14px',
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              <strong style={{ display: 'block', marginBottom: '5px' }}>Error:</strong> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading 
                ? 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)'
                : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '16px',
              transition: 'all 0.3s ease',
              boxShadow: loading ? 'none' : '0 8px 25px rgba(255, 107, 53, 0.4)',
              marginBottom: '20px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = '0 12px 35px rgba(255, 107, 53, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.4)'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {loading ? 'Loading...' : (isLogin ? 'LOGIN' : 'SIGN UP')}
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid #3a3a3a',
            borderRadius: '10px',
            cursor: 'pointer',
            color: '#ccc',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ff6b35'
            e.currentTarget.style.color = '#ff6b35'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#3a3a3a'
            e.currentTarget.style.color = '#ccc'
          }}
        >
          {isLogin ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  )
}

