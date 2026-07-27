import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Healthcheck voor Railway.
 *
 * Bewust méér dan "de server leeft": als de databaseverbinding weg is, is de
 * applicatie onbruikbaar terwijl het proces vrolijk blijft draaien. Railway
 * moet zo'n instantie niet als gezond markeren en verkeer blijven sturen.
 *
 * Geeft geen versienummers of interne details terug — dit endpoint is publiek.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 })
  }
}
