import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'CloudCast Review Booster',
  description: 'Stuur automatisch Google Review-verzoeken naar uw klanten',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className={`${dmSans.variable} ${dmSerif.variable} font-sans`}
            style={{ fontFamily: 'var(--font-body), sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
