import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { Resend } from 'resend'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sendJobs, sendJobRecipients, tenants } from '@/lib/db/schema'
import { renderReviewRequest } from '@/lib/email/template'
import { unsubscribeUrl } from '@/lib/unsubscribe'
import { enqueueJob, type ProcessJobMessage } from '@/lib/queue'

export const runtime = 'nodejs'
export const maxDuration = 60

// Resend accepteert 100 berichten per batch-call.
const BATCH_SIZE = 100

const receiver =
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      })
    : null

/**
 * Worker: verstuurt één batch van maximaal 100 e-mails en plant zichzelf
 * opnieuw in zolang er ontvangers over zijn.
 *
 * Dit endpoint staat buiten de auth-middleware, want QStash heeft geen
 * sessiecookie. De beveiliging zit in de handtekening die QStash meestuurt —
 * zonder geldige handtekening wordt het verzoek geweigerd. Anders kon iedereen
 * die een jobId kent e-mails laten versturen.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text()

  if (!receiver) {
    console.error('[worker] QStash signing keys ontbreken')
    return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 500 })
  }

  const signature = req.headers.get('upstash-signature') ?? ''
  const valid = await receiver
    .verify({ signature, body: raw })
    .catch(() => false)

  if (!valid) {
    return NextResponse.json({ error: 'Ongeldige handtekening' }, { status: 401 })
  }

  const message = JSON.parse(raw) as ProcessJobMessage
  const { jobId } = message

  const rows = await db
    .select({ job: sendJobs, tenant: tenants })
    .from(sendJobs)
    .innerJoin(tenants, eq(sendJobs.tenantId, tenants.id))
    .where(eq(sendJobs.id, jobId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    // Job bestaat niet meer: bevestigen, anders blijft QStash het proberen.
    return NextResponse.json({ ok: true, note: 'job niet gevonden' })
  }

  const { job, tenant } = row

  if (job.status === 'completed' || job.status === 'failed') {
    return NextResponse.json({ ok: true, note: 'job al afgerond' })
  }

  if (job.status === 'queued') {
    await db
      .update(sendJobs)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(sendJobs.id, jobId))
  }

  // Alleen ontvangers die nog niet verstuurd zijn. Dit maakt de worker
  // idempotent: als QStash dezelfde melding twee keer aflevert, is de tweede
  // keer deze lijst leeg voor de al verwerkte adressen.
  const pending = await db
    .select()
    .from(sendJobRecipients)
    .where(and(eq(sendJobRecipients.jobId, jobId), eq(sendJobRecipients.status, 'pending')))
    .limit(BATCH_SIZE)

  if (pending.length === 0) {
    await finalize(jobId)
    return NextResponse.json({ ok: true, done: true })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)

  const payload = pending.map((r) => {
    const unsub = unsubscribeUrl(tenant.id, r.email)
    const { subject, html, text } = renderReviewRequest({
      name: r.name,
      businessName: tenant.businessName,
      reviewLink: job.reviewLink,
      unsubscribeUrl: unsub,
    })

    return {
      from: job.fromAddress,
      to: r.email,
      reply_to: tenant.replyTo,
      subject,
      html,
      text,
      headers: {
        // Vereist voor bulkverzending: mailproviders verwachten dat een
        // ontvanger zich met één klik kan afmelden, zonder de mail te openen.
        // Ontbreekt dit, dan belandt de rest sneller in spam.
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  })

  let sent = 0
  let failed = 0

  try {
    const result = await resend.batch.send(payload)

    if (result.error) throw new Error(result.error.message)

    const ids = result.data?.data ?? []

    await Promise.all(
      pending.map((r, i) =>
        db
          .update(sendJobRecipients)
          .set({
            status: 'sent',
            resendMessageId: ids[i]?.id ?? null,
            sentAt: new Date(),
          })
          .where(eq(sendJobRecipients.id, r.id))
      )
    )
    sent = pending.length
  } catch (err) {
    // Batch mislukt: per stuk proberen, zodat één slecht adres niet de hele
    // batch tegenhoudt.
    for (const r of pending) {
      try {
        const unsub = unsubscribeUrl(tenant.id, r.email)
        const { subject, html, text } = renderReviewRequest({
          name: r.name,
          businessName: tenant.businessName,
          reviewLink: job.reviewLink,
          unsubscribeUrl: unsub,
        })

        const single = await resend.emails.send({
          from: job.fromAddress,
          to: r.email,
          reply_to: tenant.replyTo,
          subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsub}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })

        if (single.error) throw new Error(single.error.message)

        await db
          .update(sendJobRecipients)
          .set({ status: 'sent', resendMessageId: single.data?.id ?? null, sentAt: new Date() })
          .where(eq(sendJobRecipients.id, r.id))
        sent++
      } catch (inner) {
        await db
          .update(sendJobRecipients)
          .set({
            status: 'failed',
            error: inner instanceof Error ? inner.message.slice(0, 300) : 'onbekend',
          })
          .where(eq(sendJobRecipients.id, r.id))
        failed++
      }
    }
  }

  await db
    .update(sendJobs)
    .set({
      sentCount: sql`${sendJobs.sentCount} + ${sent}`,
      failedCount: sql`${sendJobs.failedCount} + ${failed}`,
    })
    .where(eq(sendJobs.id, jobId))

  // Nog werk over? Volgende batch inplannen met een korte pauze, zodat we
  // binnen de doorvoerlimieten van Resend blijven.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sendJobRecipients)
    .where(and(eq(sendJobRecipients.jobId, jobId), eq(sendJobRecipients.status, 'pending')))

  if (count > 0) {
    await enqueueJob({ jobId, batch: message.batch + 1 }, 2)
  } else {
    await finalize(jobId)
  }

  console.log(`[worker] job=${jobId} batch=${message.batch} sent=${sent} failed=${failed} rest=${count}`)

  return NextResponse.json({ ok: true, sent, failed, remaining: count })
}

async function finalize(jobId: string) {
  await db
    .update(sendJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(sendJobs.id, jobId))

  // Persoonsgegevens van eindklanten opruimen zodra de opdracht klaar is.
  // We houden alleen de tellingen op de job zelf over, zodat de klant zijn
  // historie ziet zonder dat wij adressen bewaren die we niet meer nodig
  // hebben. Mislukte adressen blijven staan zodat de klant ze kan corrigeren.
  //
  // Het adres wordt vervangen door een unieke placeholder in plaats van een
  // lege string: op (job_id, email) staat een unique index voor idempotentie,
  // en meerdere lege strings binnen één job zouden die schenden.
  await db
    .update(sendJobRecipients)
    .set({ email: sql`'redacted:' || ${sendJobRecipients.id}::text`, name: null })
    .where(and(eq(sendJobRecipients.jobId, jobId), eq(sendJobRecipients.status, 'sent')))
}
