import type { Config } from 'tailwindcss'

/*
 * Elke waarde hier verwijst naar een CSS-variabele uit app/globals.css.
 * Een merkwijziging is daardoor één aanpassing in dat ene bestand.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: 'var(--color-navy)',
          hover: 'var(--color-navy-hover)',
        },
        gold: {
          DEFAULT: 'var(--color-gold)',
          hover: 'var(--color-gold-hover)',
        },
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        line: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'DM Sans', 'sans-serif'],
      },
      fontSize: {
        sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)' }],
        base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-base)' }],
        lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)' }],
        xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-xl)' }],
      },
      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        focus: 'var(--shadow-focus)',
      },
      transitionDuration: {
        DEFAULT: 'var(--duration-fast)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-out-soft)',
        out: 'var(--ease-out)',
        'out-soft': 'var(--ease-out-soft)',
        'in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        spin: 'spin 700ms linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
