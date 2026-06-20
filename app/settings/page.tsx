'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

interface UserInfo {
  email: string
  businessName: string
  googleReviewLink: string
  fromDomain: string
  fromName: string
  replyTo: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.email) setUser(d)
    }).catch(() => {})
  }, [])

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.45)', borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 8px 32px rgba(26,68,232,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px',
  }

  const valueStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 500, color: '#1a1f36' }

  const rowStyle: React.CSSProperties = { padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }
  const lastRow: React.CSSProperties = { ...rowStyle, borderBottom: 'none' }

  const v = (val: string | undefined) => val || '—'

  return (
    <AppShell>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <h1 style={{
          fontFamily: 'var(--font-heading), serif',
          fontSize: '26px', fontWeight: 400, color: '#1a1f36', marginBottom: '8px',
        }}>
          Instellingen
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px' }}>
          Beheer je account en bedrijfsinstellingen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>

          {/* Account */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a44e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              Account
            </h2>
            <div style={rowStyle}>
              <p style={labelStyle}>E-mailadres</p>
              <p style={valueStyle}>{v(user?.email)}</p>
            </div>
            <div style={lastRow}>
              <p style={labelStyle}>Bedrijfsnaam</p>
              <p style={valueStyle}>{v(user?.businessName)}</p>
            </div>
          </div>

          {/* E-mail */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a44e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              E-mailinstellingen
            </h2>
            <div style={rowStyle}>
              <p style={labelStyle}>Afzendernaam</p>
              <p style={valueStyle}>{v(user?.fromName)}</p>
            </div>
            <div style={rowStyle}>
              <p style={labelStyle}>Afzenderdomein</p>
              <p style={valueStyle}>{v(user?.fromDomain)}</p>
            </div>
            <div style={lastRow}>
              <p style={labelStyle}>Reply-to adres</p>
              <p style={valueStyle}>{v(user?.replyTo)}</p>
            </div>
          </div>

          {/* Google Review */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a44e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Google Review
            </h2>
            <div style={lastRow}>
              <p style={labelStyle}>Review link</p>
              <p style={{ ...valueStyle, fontSize: '13px', wordBreak: 'break-all' }}>{v(user?.googleReviewLink)}</p>
            </div>
          </div>

          {/* Limieten */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a44e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Limieten &amp; beveiliging
            </h2>
            <div style={rowStyle}>
              <p style={labelStyle}>Max. bestandsgrootte</p>
              <p style={valueStyle}>5 MB</p>
            </div>
            <div style={rowStyle}>
              <p style={labelStyle}>Max. rijen per bestand</p>
              <p style={valueStyle}>1.000</p>
            </div>
            <div style={rowStyle}>
              <p style={labelStyle}>Max. e-mails per batch</p>
              <p style={valueStyle}>500</p>
            </div>
            <div style={lastRow}>
              <p style={labelStyle}>Sessieduur</p>
              <p style={valueStyle}>24 uur</p>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
