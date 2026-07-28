'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import FileUpload from '@/components/FileUpload'
import Chat from '@/components/Chat'
import { Card, cn } from '@/components/ui'
import { RawRow } from '@/lib/types'
import { domeinUitleg, magVersturen } from '@/lib/domain-status'

interface Account {
  sendingDomain: string
  domainStatus: string
}

export default function Home() {
  const [uploadTrigger, setUploadTrigger] = useState<RawRow[] | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [laden, setLaden] = useState(true)
  const hasUpload = uploadTrigger !== null && uploadTrigger.length > 0

  useEffect(() => {
    // De status wordt eerst opnieuw bij Resend nagevraagd; de opgeslagen waarde
    // kan achterlopen op een verificatie die inmiddels rond is.
    fetch('/api/domain')
      .then(r => r.json())
      .then(d => setAccount({ sendingDomain: d.sendingDomain, domainStatus: d.status }))
      .catch(() => {})
      .finally(() => setLaden(false))
  }, [])

  /*
   * Wie niet kan versturen, ziet ook geen uploadveld.
   *
   * De controle draait op de achtergrond en het scherm wacht er niet op. Deed
   * het dat wel, dan opende de app met een leeg vlak en een spinnertje zolang
   * het rondje langs Resend duurde — bij elke keer laden opnieuw. Bijna iedereen
   * mag gewoon versturen; de uitzondering mag een fractie later verschijnen.
   */
  if (!laden && account && !magVersturen(account.domainStatus)) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center p-8">
          <Card className="w-full max-w-lg">
            <h1 className="text-lg font-medium">Nog niet klaar om te versturen</h1>
            <p className="mt-4 text-base text-ink-muted">
              {domeinUitleg(account.sendingDomain, account.domainStatus)}
            </p>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/*
          Eén FileUpload, alleen een andere omhulling. Stond hij in twee takken
          van een ternary, dan ziet React dat als een ander element: het oude
          wordt weggegooid en het nieuwe begint zonder bestandsnaam, waardoor de
          kop het volledige uploadveld liet zien terwijl er al een bestand lag.
        */}
        <div
          className={cn(
            hasUpload
              ? 'shrink-0 border-b border-line'
              : 'flex flex-1 items-center justify-center px-6 py-12',
          )}
        >
          <div
            className={cn(
              hasUpload ? 'mx-auto w-full max-w-2xl px-6 py-4' : 'w-full max-w-lg animate-rise-in',
            )}
          >
            <FileUpload
              onDataParsed={(rows: RawRow[]) => setUploadTrigger(rows)}
              compact={hasUpload}
            />
          </div>
        </div>

        {hasUpload && (
          <div className="flex-1 overflow-hidden">
            <Chat uploadTrigger={uploadTrigger} onContactsExtracted={() => {}} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
