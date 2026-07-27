import { ReactNode } from 'react'

interface LabelProps {
  htmlFor?: string
  children: ReactNode
}

/** Veldlabel — één grootte, één gewicht, gedempte kleur. */
export function Label({ htmlFor, children }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-muted">
      {children}
    </label>
  )
}

interface FieldProps {
  label: string
  htmlFor?: string
  children: ReactNode
}

/** Label plus invoerveld, met vaste tussenruimte. */
export default function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
