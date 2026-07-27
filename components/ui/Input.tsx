import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from './cn'

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-ink',
          'placeholder:text-ink-subtle transition-colors',
          'focus:border-gold focus:shadow-focus focus:outline-none',
          'disabled:bg-canvas disabled:text-ink-subtle',
          className,
        )}
        {...props}
      />
    )
  },
)

export default Input
