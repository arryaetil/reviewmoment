'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Inloggen mislukt.')
        setLoading(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Verbindingsfout. Probeer opnieuw.')
      setLoading(false)
    }
  }

  const disabled = loading || !email || !password

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f8f9ff 40%, #f5f3ff 100%)',
      backgroundImage: `
        radial-gradient(ellipse at 30% 10%, rgba(26, 68, 232, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 30%, rgba(99, 140, 255, 0.10) 0%, transparent 50%),
        radial-gradient(ellipse at 40% 80%, rgba(167, 139, 250, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 90% 90%, rgba(56, 189, 248, 0.05) 0%, transparent 50%),
        linear-gradient(180deg, #eef2ff 0%, #f8f9ff 40%, #f5f3ff 100%)
      `,
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        animation: 'fadeUp .5s ease both',
      }}>
        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/logo-icon.png"
            alt="CloudCast"
            style={{
              height: '72px',
              display: 'block',
              margin: '0 auto 20px',
              filter: 'drop-shadow(0 4px 12px rgba(26, 68, 232, 0.15))',
            }}
          />
          <h1 style={{
            fontFamily: 'var(--font-heading), serif',
            fontSize: '28px',
            fontWeight: 400,
            color: '#1a1f36',
            marginBottom: '8px',
          }}>
            Review Booster
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.5 }}>
            Log in om reviewverzoeken te versturen
          </p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            borderRadius: '24px',
            padding: '36px',
            boxShadow: '0 8px 32px rgba(26, 68, 232, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1a1f36',
              marginBottom: '8px',
            }}>
              E-mailadres
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jouw@bedrijf.nl"
              required
              autoFocus
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                height: '48px',
                borderRadius: '14px',
                padding: '0 16px',
                fontSize: '15px',
                fontFamily: 'inherit',
                color: '#1a1f36',
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
                outline: 'none',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1a1f36',
              marginBottom: '8px',
            }}>
              Wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Uw wachtwoord"
              required
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                height: '48px',
                borderRadius: '14px',
                padding: '0 16px',
                fontSize: '15px',
                fontFamily: 'inherit',
                color: '#1a1f36',
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
                outline: 'none',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              marginBottom: '18px',
              background: 'rgba(254, 202, 202, 0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(252, 165, 165, 0.5)',
              borderRadius: '14px',
              fontSize: '13px',
              color: '#991b1b',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: 'white',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled
                ? 'rgba(107, 114, 128, 0.4)'
                : 'linear-gradient(135deg, #1a44e8 0%, #3a5ff5 60%, #5b7aff 100%)',
              boxShadow: disabled
                ? 'none'
                : '0 4px 14px rgba(26, 68, 232, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              transition: 'transform 0.15s, box-shadow 0.2s',
            }}
          >
            {loading && (
              <div style={{
                width: '18px', height: '18px',
                border: '2px solid rgba(255,255,255,.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin .7s linear infinite',
              }} />
            )}
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        {/* Demo quick login */}
        <button
          type="button"
          onClick={() => {
            setEmail('demo@cloudcast.nl')
            setPassword('demo123')
            setTimeout(() => {
              const form = document.querySelector('form')
              form?.requestSubmit()
            }, 100)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'inherit',
            color: '#1a44e8',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Inloggen met demo-account
        </button>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '12px',
          color: '#6b7280',
          opacity: 0.7,
        }}>
          CloudCast Review Booster
        </p>
      </div>
    </div>
  )
}
