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
   * Eerder bleek dat pas ná het uploaden, het wachten op de analyse en het
   * indrukken van de verzendknop. Dat is werk dat nooit tot iets kon leiden, en
   * het beheeraccount kwam er standaard op uit.
   */
  // De controle draait op de achtergrond; het scherm wacht er niet op.
  // Anders opent de app met een leeg vlak en een spinnertje.
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
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
        {/* De sprong van "uploadvlak vult het scherm" naar "smalle regel met
            het gesprek eronder" is de grootste indelingswijziging in de app.
            Zonder overgang lijkt het alsof het scherm knippert. */}
        <div
          className={cn(
            'transition-all duration-slow ease-out',
            hasUpload ? 'shrink-0' : 'flex flex-1 items-center justify-center',
          )}
        >
          <Card flush className={hasUpload ? 'px-6 py-4' : 'w-full max-w-lg p-8'}>
            <FileUpload
              onDataParsed={(rows: RawRow[]) => setUploadTrigger(rows)}
              compact={hasUpload}
            />
          </Card>
        </div>

        {hasUpload && (
          <div className="flex-1 animate-rise-in overflow-hidden">
            <Chat uploadTrigger={uploadTrigger} onContactsExtracted={() => {}} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
