'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import { cn } from '@/components/ui'

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

/**
 * Eén regel: wat het is, en wat het bij jou is.
 *
 * Geen kaders om elke groep. Vier kaarten onder elkaar met dezelfde vorm zeggen
 * niets over de inhoud; de tussenruimte doet dat werk beter en laat de pagina
 * ademen.
 */
function Regel({ label, value, hint, hintTone, breed }: {
  label: string
  value: string
  hint?: string
  hintTone?: string
  breed?: boolean
}) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6 sm:py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd>
        {/* tabular-nums houdt de cijfers onder elkaar uitgelijnd; anders
            danst "1.000" ten opzichte van "500". */}
        <span className={cn('text-base tabular-nums text-ink', breed && 'break-all')}>{value}</span>
        {hint && <span className={cn('mt-1 block text-sm', hintTone)}>{hint}</span>}
      </dd>
    </div>
  )
}

function Sectie({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="text-base font-medium text-ink">{titel}</h2>
      <dl className="mt-2 divide-y divide-line">{children}</dl>
    </section>
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
      <div className="flex-1 overflow-y-auto px-8 py-12">
        <div className="mx-auto max-w-2xl">
          <header className="mb-12">
            <h1 className="text-xl font-medium">Instellingen</h1>
            <p className="mt-3 text-base text-ink-muted">
              Zo staat je account ingesteld. Neem contact op als er iets moet veranderen.
            </p>
          </header>

          <div className="flex flex-col gap-12">
            <Sectie titel="Account">
              <Regel label="E-mailadres" value={v(user?.email)} />
              <Regel label="Bedrijfsnaam" value={v(user?.businessName)} />
            </Sectie>

            <Sectie titel="Wat je klanten zien">
              <Regel label="Afzendernaam" value={v(user?.fromName)} />
              <Regel
                label="Verzenddomein"
                value={v(user?.sendingDomain)}
                hint={user?.domainStatus && DOMAIN_LABEL[user.domainStatus]}
                hintTone={user?.domainStatus && DOMAIN_TONE[user.domainStatus]}
                breed
              />
              <Regel label="Antwoorden gaan naar" value={v(user?.replyTo)} />
              <Regel label="Reviewlink" value={v(user?.googleReviewLink)} breed />
            </Sectie>

            <Sectie titel="Limieten">
              <Regel label="Max. bestandsgrootte" value="5 MB" />
              <Regel label="Max. rijen per bestand" value="1.000" />
              <Regel label="Max. e-mails per batch" value="500" />
              <Regel label="Sessieduur" value="24 uur" />
            </Sectie>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
