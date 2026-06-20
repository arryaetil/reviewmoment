import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'DM Sans', 'sans-serif'],
        heading: ['var(--font-heading)', 'DM Serif Display', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
