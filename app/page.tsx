'use client'

import { useState } from 'react'
import AppShell from '@/components/AppShell'
import FileUpload from '@/components/FileUpload'
import Chat from '@/components/Chat'
import { Card } from '@/components/ui'
import { RawRow } from '@/lib/types'

export default function Home() {
  const [uploadTrigger, setUploadTrigger] = useState<RawRow[] | null>(null)
  const hasUpload = uploadTrigger !== null && uploadTrigger.length > 0

  return (
    <AppShell>
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
        {/* Vóór de upload vult het uploadvlak het scherm; daarna krimpt het tot
            een regel en neemt de chat de ruimte over. */}
        <div className={hasUpload ? 'shrink-0' : 'flex flex-1 items-center justify-center'}>
          <Card flush className={hasUpload ? 'px-6 py-4' : 'w-full max-w-lg p-8'}>
            <FileUpload
              onDataParsed={(rows: RawRow[]) => setUploadTrigger(rows)}
              compact={hasUpload}
            />
          </Card>
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
