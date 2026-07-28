'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { cn } from '@/components/ui'

const NAV_ITEMS = [
  { href: '/', label: 'Versturen' },
  { href: '/settings', label: 'Instellingen' },
]

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
    <div className="flex h-screen bg-canvas">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
        <div className="mb-8 px-2">
          <img src="/logo-horizontal.svg" alt="reviewmoment.nl" width={384} height={78} className="h-7 w-auto" />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md border-l-2 px-3 py-2 text-left text-base transition-colors',
                  active
                    ? 'border-gold bg-canvas font-medium text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          {businessName && (
            <p className="mb-1 text-sm font-medium text-ink">{businessName}</p>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
