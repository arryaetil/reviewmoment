import { ReactNode } from 'react'
import { cn } from './cn'

interface Props {
  children: ReactNode
  tone?: 'error' | 'neutral'
}

/*
 * Geen icoon en geen gekleurd vlak: de melding zelf is het signaal, de kleur
 * van de tekst het accent.
 */
export default function Notice({ children, tone = 'neutral' }: Props) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'rounded-md border border-line bg-canvas px-4 py-3 text-sm',
        tone === 'error' ? 'text-danger' : 'text-ink-muted',
      )}
    >
      {children}
    </p>
  )
}
