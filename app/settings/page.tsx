'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import { Card, cn } from '@/components/ui'

interface UserInfo {
  email: string
  businessName: string
  googleReviewLink: string
  sendingDomain: string
  domainStatus: 'pending' | 'verifying' | 'verified' | 'failed'
  fromName: string
  replyTo: string
}

const DOMAIN_LABEL: Record<UserInfo['domainStatus'], string> = {
  pending: 'Nog niet ingesteld',
  verifying: 'Wordt geverifieerd — dit kan tot een uur duren',
  verified: 'Geverifieerd',
  failed: 'Verificatie mislukt — neem contact op',
}

/* Alleen een mislukte verificatie vraagt om actie; de rest blijft neutraal. */
const DOMAIN_TONE: Record<UserInfo['domainStatus'], string> = {
  pending: 'text-ink-muted',
  verifying: 'text-ink-muted',
  verified: 'text-success',
  failed: 'text-danger',
}

function Row({ label, value, last, className }: {
  label: string
  value: string
  last?: boolean
  className?: string
}) {
  return (
    <div className={cn('py-3', !last && 'border-b border-line')}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('mt-1 text-base text-ink', className)}>{value}</p>
    </div>
  )
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.email) setUser(d)
    }).catch(() => {})
  }, [])

  const v = (val: string | undefined) => val || '—'

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl">
          <h1 className="font-heading text-xl">Instellingen</h1>
          <p className="mt-2 text-base text-ink-muted">
            Beheer je account en bedrijfsinstellingen.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <Card>
              <h2 className="text-base font-medium text-ink">Account</h2>
              <div className="mt-2">
                <Row label="E-mailadres" value={v(user?.email)} />
                <Row label="Bedrijfsnaam" value={v(user?.businessName)} last />
              </div>
            </Card>

            <Card>
              <h2 className="text-base font-medium text-ink">E-mailinstellingen</h2>
              <div className="mt-2">
                <Row label="Afzendernaam" value={v(user?.fromName)} />
                <div className="border-b border-line py-3">
                  <p className="text-sm text-ink-muted">Afzenderdomein</p>
                  <p className="mt-1 text-base text-ink">{v(user?.sendingDomain)}</p>
                  {user?.domainStatus && (
                    <p className={cn('mt-1 text-sm', DOMAIN_TONE[user.domainStatus])}>
                      {DOMAIN_LABEL[user.domainStatus]}
                    </p>
                  )}
                </div>
                <Row label="Reply-to adres" value={v(user?.replyTo)} last />
              </div>
            </Card>

            <Card>
              <h2 className="text-base font-medium text-ink">Google Review</h2>
              <div className="mt-2">
                <Row
                  label="Reviewlink"
                  value={v(user?.googleReviewLink)}
                  className="break-all"
                  last
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-base font-medium text-ink">Limieten</h2>
              <div className="mt-2">
                <Row label="Max. bestandsgrootte" value="5 MB" />
                <Row label="Max. rijen per bestand" value="1.000" />
                <Row label="Max. e-mails per batch" value="500" />
                <Row label="Sessieduur" value="24 uur" last />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
