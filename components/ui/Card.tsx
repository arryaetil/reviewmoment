import { ReactNode } from 'react'
import { cn } from './cn'

interface Props {
  children: ReactNode
  className?: string
  /** Zonder padding als de inhoud zelf de randen raakt, zoals het chatvenster. */
  flush?: boolean
}

/** Plat vlak met een dunne rand en hooguit één subtiele schaduw. */
export default function Card({ children, className, flush }: Props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface shadow-card',
        !flush && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
