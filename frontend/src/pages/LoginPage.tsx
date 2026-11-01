import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertTriangle } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your email address and password.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const res = await apiClient.post('/auth/login', {
        email: email.trim(),
        password
      })
      const { token, user, mailboxes } = res.data
      setAuth(token, user, mailboxes || [])
      navigate('/inbox', { replace: true })
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Authentication failed. Please verify your email and password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#070707',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Subtle Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(211, 47, 47, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#121212',
          border: '1px solid #222222',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(211, 47, 47, 0.12)',
              border: '1px solid rgba(211, 47, 47, 0.3)',
              marginBottom: '16px'
            }}
          >
            <img
              src="https://portal.teamarchon.in/favicon.png"
              alt="Archon"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '6px',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            ARCHON <span style={{ color: 'var(--accent-red)' }}>MAIL</span>
          </h1>
          <p style={{ color: '#888888', fontSize: '13px' }}>
            Enterprise Webmail & Messaging System
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(211, 47, 47, 0.12)',
              border: '1px solid rgba(211, 47, 47, 0.35)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              color: '#ff6b6b',
              fontSize: '13px'
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#aaaaaa',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}
            >
              Email Address
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#0a0a0a',
                border: '1px solid #262626',
                borderRadius: '10px',
                padding: '0 14px',
                transition: 'border-color 0.2s'
              }}
            >
              <Mail size={18} style={{ color: '#666', marginRight: '10px', flexShrink: 0 }} />
              <input
                type="email"
                required
                placeholder="name@teamarchon.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  padding: '12px 0'
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#aaaaaa',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}
            >
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#0a0a0a',
                border: '1px solid #262626',
                borderRadius: '10px',
                padding: '0 14px',
                transition: 'border-color 0.2s'
              }}
            >
              <Lock size={18} style={{ color: '#666', marginRight: '10px', flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  padding: '12px 0'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              background: 'var(--accent-red)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(211, 47, 47, 0.35)',
              transition: 'background 0.2s, transform 0.1s'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Info Box */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid #1f1f1f',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            color: '#777777',
            fontSize: '12px',
            lineHeight: 1.5
          }}
        >
          <ShieldCheck size={16} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            Accounts, mailboxes, and security permissions are provisioned and managed by Team Archon administrators.
          </span>
        </div>
      </div>
    </div>
  )
}
