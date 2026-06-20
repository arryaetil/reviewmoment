'use client'

import { useRef, useState, useCallback } from 'react'
import { RawRow } from '@/lib/types'

const MAX_FILE_SIZE_MB = 5
const MAX_ROWS = 1000

interface Props {
  onDataParsed: (rows: RawRow[]) => void
  compact?: boolean
}

export default function FileUpload({ onDataParsed, compact }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setError(null)
    setStatus('parsing')
    setFileName(file.name)

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Bestand is te groot (max ${MAX_FILE_SIZE_MB}MB)`)
      setStatus('error')
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      let rows: RawRow[] = []

      if (ext === 'csv' || ext === 'txt') {
        const Papa = (await import('papaparse')).default
        const text = await file.text()
        const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true })
        rows = result.data
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[wb.SheetNames[0]])
      } else {
        setError('Ondersteunde formaten: CSV, XLSX, XLS, TXT')
        setStatus('error')
        return
      }

      if (rows.length > MAX_ROWS) {
        setError(`Bestand bevat meer dan ${MAX_ROWS} rijen. Splits het bestand op.`)
        setStatus('error')
        return
      }

      setRowCount(rows.length)
      setStatus('done')
      onDataParsed(rows)
    } catch {
      setError('Kon het bestand niet lezen. Controleer het formaat.')
      setStatus('error')
    }
  }, [onDataParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  // Compact mode: show a small status bar with file info + replace button
  if (compact && status === 'done' && fileName) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1f36' }}>{fileName}</span>
          <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>{rowCount} rijen</span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            padding: '6px 14px', fontSize: '12px', fontWeight: 500,
            color: '#1a44e8', background: 'rgba(26,68,232,0.06)',
            border: '1px solid rgba(26,68,232,0.12)', borderRadius: '10px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Ander bestand
        </button>
        <input
          ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.txt"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeUp .45s ease both' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading), serif',
          fontSize: '24px', fontWeight: 400, color: '#1a1f36', marginBottom: '8px',
        }}>
          Klantenbestand uploaden
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
          Upload een CSV of Excel bestand met klantgegevens. Cloudy herkent automatisch de e-mailadressen.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          textAlign: 'center',
          cursor: 'pointer',
          border: `2px dashed ${isDragging ? '#1a44e8' : 'rgba(26, 68, 232, 0.2)'}`,
          borderRadius: '18px',
          padding: '48px 24px',
          background: isDragging ? 'rgba(26, 68, 232, 0.06)' : 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'rgba(26, 68, 232, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#1a44e8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p style={{ fontSize: '16px', fontWeight: 500, color: '#1a1f36', marginBottom: '6px' }}>
          Sleep je bestand hierheen
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          of <span style={{ color: '#1a44e8', fontWeight: 500 }}>klik om te bladeren</span>
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
          {['CSV', 'XLSX', 'XLS', 'TXT'].map(f => (
            <span key={f} style={{
              padding: '4px 12px', fontSize: '12px', fontWeight: 500,
              background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: '8px', color: '#6b7280',
            }}>
              {f}
            </span>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>
          Maximaal {MAX_FILE_SIZE_MB}MB &middot; {MAX_ROWS} rijen
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.txt"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
      />

      {/* Parsing */}
      {status === 'parsing' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          borderRadius: '14px', padding: '14px 18px',
          background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.35)',
          fontSize: '14px', color: '#1a44e8', fontWeight: 500,
        }}>
          <div style={{
            width: '18px', height: '18px', flexShrink: 0,
            border: '2px solid rgba(26,68,232,.2)', borderTopColor: '#1a44e8',
            borderRadius: '50%', animation: 'spin .7s linear infinite',
          }} />
          Bestand verwerken...
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '14px 18px', borderRadius: '14px',
          background: 'rgba(254, 226, 226, 0.5)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(252, 165, 165, 0.4)',
          fontSize: '13px', color: '#991b1b',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}
