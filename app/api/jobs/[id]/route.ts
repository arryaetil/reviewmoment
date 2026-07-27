import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sendJobs } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Status van een verzendopdracht, zodat de chat de voortgang kan tonen. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(sendJobs)
    // Altijd op tenantId meefilteren: zonder dat kan een klant met een geldige
    // sessie de status van de opdracht van een andere klant opvragen door een
    // ander id in de URL te zetten.
    .where(and(eq(sendJobs.id, params.id), eq(sendJobs.tenantId, session.tenant.id)))
    .limit(1)

  const job = rows[0]
  if (!job) {
    return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    total: job.totalRecipients,
    sent: job.sentCount,
    failed: job.failedCount,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  })
}
