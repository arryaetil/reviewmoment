import { NextRequest, NextResponse } from 'next/server'
import { inArray, and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sendJobs, sendJobRecipients, suppressions } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { sendLimiter, consumeMonthlyQuota, releaseQuota } from '@/lib/rate-limit'
import { enqueueJob } from '@/lib/queue'
import { hashEmail } from '@/lib/unsubscribe'
import { prepareRecipients } from '@/lib/recipients'
import type { Contact } from '@/lib/types'

export const runtime = 'nodejs'

const MAX_PER_JOB = 2000

/**
 * Deze route verstuurt zelf niets meer.
 *
 * In de POC liep hier een for-loop die per contact een await op Resend deed.
 * Bij 500 adressen is dat al snel enkele minuten — ruim voorbij de limiet van
 * een serverless functie. De functie werd dan halverwege afgekapt, waarbij een
 * deel van de klanten wél mail kreeg en de gebruiker een timeout zag, zonder
 * dat iemand wist waar het was gestopt. Opnieuw proberen betekende dubbele
 * mail naar de eerste helft.
 *
 * Nu leggen we de opdracht vast in de database en zetten we hem in de wachtrij.
 * De worker verstuurt in batches en houdt per ontvanger bij wat er is gebeurd.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const { user, tenant } = session

  const { success } = await sendLimiter.limit(tenant.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Te veel verzoeken achter elkaar. Probeer het zo opnieuw.' },
      { status: 429 }
    )
  }

  if (tenant.domainStatus !== 'verified') {
    return NextResponse.json(
      {
        error:
          'Je verzenddomein is nog niet geverifieerd. Zodra dat rond is kun je versturen.',
        domainStatus: tenant.domainStatus,
      },
      { status: 409 }
    )
  }

  let body: { contacts?: Contact[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  if (!Array.isArray(body.contacts)) {
    return NextResponse.json({ error: 'Ongeldige contactenlijst' }, { status: 400 })
  }

  // Valideren en ontdubbelen zit in lib/recipients.ts, zodat die logica
  // getest kan worden zonder database of sessie.
  const { recipients: candidates } = prepareRecipients(body.contacts)

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Geen geldige e-mailadressen om te versturen' }, { status: 400 })
  }

  if (candidates.length > MAX_PER_JOB) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_PER_JOB} adressen per verzending.` },
      { status: 400 }
    )
  }

  // Uitschrijvingen en eerdere bounces eruit filteren.
  //
  // Let op het onderscheid: dit is géén review gating. We filteren niet op
  // tevredenheid of verwachte score — we respecteren alleen mensen die hebben
  // aangegeven geen mail meer te willen, en adressen die niet bestaan. Iedere
  // klant die niet heeft afgemeld krijgt hetzelfde verzoek.
  const hashes = candidates.map((c) => hashEmail(c.email))
  const suppressed = await db
    .select({ hash: suppressions.emailHash })
    .from(suppressions)
    .where(and(eq(suppressions.tenantId, tenant.id), inArray(suppressions.emailHash, hashes)))

  const suppressedSet = new Set(suppressed.map((s) => s.hash))
  const recipients = candidates.filter((c) => !suppressedSet.has(hashEmail(c.email)))
  const skippedUnsubscribed = candidates.length - recipients.length

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'Alle adressen op deze lijst hebben zich afgemeld.' },
      { status: 400 }
    )
  }

  const quota = await consumeMonthlyQuota(tenant.id, recipients.length, tenant.monthlyEmailLimit)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Maandlimiet bereikt. Je hebt nog ${quota.remaining} e-mails over deze maand.`,
        remaining: quota.remaining,
      },
      { status: 429 }
    )
  }

  try {
    const jobId = await db.transaction(async (tx) => {
      const [job] = await tx
        .insert(sendJobs)
        .values({
          tenantId: tenant.id,
          createdByUserId: user.id,
          status: 'queued',
          totalRecipients: recipients.length,
          fromAddress: `${tenant.fromName} <reviews@${tenant.sendingDomain}>`,
          reviewLink: tenant.googleReviewLink,
        })
        .returning({ id: sendJobs.id })

      await tx.insert(sendJobRecipients).values(
        recipients.map((r) => ({ jobId: job.id, email: r.email, name: r.name }))
      )

      return job.id
    })

    await enqueueJob({ jobId, batch: 0 })

    console.log(`[send] job=${jobId} tenant=${tenant.id} queued=${recipients.length}`)

    return NextResponse.json({
      jobId,
      queued: recipients.length,
      skippedUnsubscribed,
      remainingThisMonth: quota.remaining,
    })
  } catch (err) {
    // Quotum teruggeven: er is niets verstuurd, dus het mag niet meetellen.
    await releaseQuota(tenant.id, recipients.length)
    console.error('[send] kon opdracht niet aanmaken', err instanceof Error ? err.message : '')
    return NextResponse.json(
      { error: 'Kon de verzending niet inplannen. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}
