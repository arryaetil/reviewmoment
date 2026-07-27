import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migraties draaien via de directe verbinding, niet via de pooler.
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!,
  },
} satisfies Config
