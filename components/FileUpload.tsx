'use client'

import { useRef, useState, useCallback } from 'react'
import { RawRow } from '@/lib/types'
import { Button, Notice, Spinner, cn } from '@/components/ui'

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

      /*
       * Een export eindigt vaak op een lege regel, en die telde mee als
       * ontvanger zonder adres. Dan meldt het scherm "2 rijen zonder adres"
       * terwijl er één persoon zonder adres in staat — een verschil dat de
       * gebruiker niet kan verklaren en dat hem aan het twijfelen brengt.
       */
      rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''))

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

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,.xlsx,.xls,.txt"
      className="hidden"
      onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
    />
  )

  // Compacte modus: een regel met het gekozen bestand en een knop om te wisselen.
  if (compact && status === 'done' && fileName) {
    return (
      <div className="flex items-center gap-4">
        <p className="flex-1 text-base">
          <span className="font-medium text-ink">{fileName}</span>
          <span className="ml-2 text-ink-muted">{rowCount} rijen</span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Ander bestand
        </Button>
        {fileInput}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Klantenbestand uploaden</h2>
        <p className="mt-2 text-base text-ink-muted">
          Een CSV- of Excelbestand met klantgegevens. De e-mailadressen worden
          automatisch herkend.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'w-full rounded-lg border border-dashed px-6 py-12 text-center',
          'transition-[background-color,border-color,transform] duration-base ease-out',
          // Bij het slepen zet het vlak zich een fractie uit. Dat is de enige
          // bevestiging die iemand krijgt dat hij boven het juiste doel hangt;
          // een kleurverschil alleen is met een bestand onder je cursor te
          // makkelijk te missen.
          isDragging
            ? 'scale-[1.01] border-gold bg-canvas'
            : 'border-line-strong bg-surface hover:border-line-strong hover:bg-canvas',
        )}
      >
        <span className="block text-base font-medium text-ink">
          {isDragging ? 'Laat los om te uploaden' : 'Sleep je bestand hierheen of klik om te bladeren'}
        </span>
        <span className="mt-2 block text-sm text-ink-muted">
          CSV, XLSX, XLS of TXT &middot; maximaal {MAX_FILE_SIZE_MB} MB en {MAX_ROWS} rijen
        </span>
      </button>

      {fileInput}

      {status === 'parsing' && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner />
          Bestand verwerken…
        </p>
      )}

      {status === 'error' && error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
