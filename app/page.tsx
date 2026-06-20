'use client'

import { useState } from 'react'
import AppShell from '@/components/AppShell'
import FileUpload from '@/components/FileUpload'
import Chat from '@/components/Chat'
import { RawRow } from '@/lib/types'

export default function Home() {
  const [uploadTrigger, setUploadTrigger] = useState<RawRow[] | null>(null)
  const hasUpload = uploadTrigger !== null && uploadTrigger.length > 0

  return (
    <AppShell>
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
        padding: '16px', gap: '16px',
      }}>
        {/* Upload section — full width when no upload, compact strip after upload */}
        <div style={{
          flexShrink: 0,
          padding: hasUpload ? '20px 28px' : '32px',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.45)', borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(26,68,232,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)',
          transition: 'all 0.3s ease',
          ...(!hasUpload ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
        }}>
          <div style={{ width: '100%', maxWidth: hasUpload ? '100%' : '520px' }}>
            <FileUpload
              onDataParsed={(rows: RawRow[]) => setUploadTrigger(rows)}
              compact={hasUpload}
            />
          </div>
        </div>

        {/* Chat — slides in after upload */}
        {hasUpload && (
          <div style={{
            flex: 1, overflow: 'hidden',
            animation: 'fadeUp .4s ease both',
          }}>
            <Chat uploadTrigger={uploadTrigger} onContactsExtracted={() => {}} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
