import { cn } from './cn'

/** De enige beweging in de applicatie: laadstatus. */
export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-navy',
        className,
      )}
    />
  )
}
