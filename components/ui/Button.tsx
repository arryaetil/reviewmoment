import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/*
 * Goud draagt precies één rol: de handeling die de gebruiker moet doen.
 * Daarom heeft alleen `primary` die kleur; al het andere is neutraal.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-navy hover:bg-gold-hover disabled:bg-line disabled:text-ink-muted',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas disabled:text-ink-muted',
  ghost: 'text-ink-muted hover:text-ink disabled:text-ink-muted',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-base',
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex touch-manipulation items-center justify-center gap-2 rounded-md font-medium',
        // Asymmetrisch: indrukken gaat sneller dan loslaten. Je vinger is er al
        // voordat het scherm reageert, dus de reactie moet je inhalen; het
        // terugveren mag je zien. Drie procent krimp is waar een knop aanvoelt
        // als indrukken zonder dat het opvalt als animatie.
        'transition-[color,background-color,border-color,transform] duration-fast ease-out',
        'active:duration-press active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})

export default Button
