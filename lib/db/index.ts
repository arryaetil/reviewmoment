import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Verbinding wordt pas opgezet bij het eerste gebruik, niet bij het importeren.
 *
 * Next.js laadt tijdens de build elke route-module in om metadata te verzamelen.
 * Zou dit bestand bij import al een verbinding eisen, dan faalt de build op elke
 * machine zonder databasegegevens — inclusief CI.
 */
let _client: ReturnType<typeof postgres> | null = null
let _db: PostgresJsDatabase<typeof schema> | null = null

function connect(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ontbreekt')

  // Supabase draait achter een pooler (pgbouncer in transaction mode). Daar
  // mogen geen prepared statements worden gebruikt, vandaar prepare: false.
  //
  // De poolgrootte hangt af van waar je draait. Op serverless (Vercel) leeft
  // elke instantie kort en is één verbinding juist: honderd instanties met
  // tien verbindingen leggen anders de database plat. Op een langlevend
  // proces (Railway, Docker) is één verbinding juist fout — dan staat al je
  // gelijktijdige verkeer in de rij voor diezelfde socket.
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  const max = Number(process.env.DB_POOL_MAX) || (serverless ? 1 : 10)

  _client = postgres(url, { prepare: false, max, idle_timeout: 20 })
  _db = drizzle(_client, { schema })
  return _db
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = connect()
    const value = Reflect.get(instance as object, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
