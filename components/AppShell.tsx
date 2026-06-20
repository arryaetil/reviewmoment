'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'

const NAV_ITEMS = [
  { href: '/', label: 'Versturen', icon: 'send' },
  { href: '/settings', label: 'Instellingen', icon: 'settings' },
]

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#1a44e8' : '#6b7280'
  if (type === 'send') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
  if (type === 'settings') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
  return null
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.businessName) setBusinessName(d.businessName)
    }).catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: `
      radial-gradient(ellipse at 20% 0%, rgba(26,68,232,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(99,140,255,0.07) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 100%, rgba(167,139,250,0.06) 0%, transparent 50%),
      linear-gradient(180deg, #f0f4ff 0%, #f8f9ff 50%, #f5f3ff 100%)
    ` }}>

      {/* Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        padding: '20px 12px',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '1px 0 12px rgba(26,68,232,0.03)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '4px 12px', marginBottom: '32px',
        }}>
          <img src="/logo-icon.png" alt="" style={{
            height: '32px', width: 'auto',
            filter: 'drop-shadow(0 2px 4px rgba(26,68,232,.12))',
          }} />
          <span style={{
            fontFamily: 'var(--font-heading), serif',
            fontSize: '17px', fontWeight: 400, color: '#1a1f36',
          }}>
            Review Booster
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '12px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '14px', fontWeight: active ? 500 : 400,
                color: active ? '#1a44e8' : '#6b7280',
                background: active ? 'rgba(26,68,232,0.08)' : 'transparent',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}>
                <NavIcon type={item.icon} active={active} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div style={{
          padding: '16px 14px', borderTop: '1px solid rgba(0,0,0,0.06)',
          marginTop: '8px',
        }}>
          {businessName && (
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#1a1f36', marginBottom: '4px' }}>
              {businessName}
            </p>
          )}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '0', border: 'none', background: 'none',
            fontSize: '12px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
