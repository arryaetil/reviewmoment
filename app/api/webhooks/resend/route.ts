import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { suppressions, tenants } from '@/lib/db/schema'
import { hashEmail } from '@/lib/unsubscribe'

export const runtime = 'nodejs'

/**
 * Bounces en spamklachten van Resend.
 *
 * Zonder dit blijf je mailen naar adressen die niet bestaan, en dat is het
 * snelste manier om je verzendreputatie te verpesten: mailproviders wegen een
 * hoog bouncepercentage zwaar mee. Elk hard gebouncet adres en elke klacht
 * gaat hier direct op de suppressielijst van de betreffende tenant.
 */

// Resend gebruikt Svix voor webhooks.
function verifySvix(payload: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatures = headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false

  // Replay-aanvallen weren: meldingen ouder dan vijf minuten afwijzen.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64')

  // De header kan meerdere versies bevatten, spatie-gescheiden: "v1,<sig> v1,<sig>"
  return signatures.split(' ').some((entry) => {
    const sig = entry.split(',')[1]
    if (!sig) return false
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    console.error('[webhook] RESEND_WEBHOOK_SECRET ontbreekt')
    return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 500 })
  }

  if (!verifySvix(raw, req.headers, secret)) {
    return NextResponse.json({ error: 'Ongeldige handtekening' }, { status: 401 })
  }

  const event = JSON.parse(raw) as {
    type: string
    data?: { to?: string[]; from?: string; bounce?: { type?: string } }
  }

  const isHardBounce =
    event.type === 'email.bounced' && event.data?.bounce?.type?.toLowerCase() !== 'transient'
  const isComplaint = event.type === 'email.complained'

  if (!isHardBounce && !isComplaint) {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const recipient = event.data?.to?.[0]
  const fromDomain = event.data?.from?.match(/@([^>\s]+)/)?.[1]

  if (!recipient || !fromDomain) {
    return NextResponse.json({ ok: true, note: 'onvolledige melding' })
  }

  // Het verzenddomein bepaalt om welke tenant het gaat — precies de reden om
  // elke klant een eigen subdomein te geven in plaats van één gedeeld domein.
  const rows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.sendingDomain, fromDomain))
    .limit(1)

  const tenant = rows[0]
  if (!tenant) {
    return NextResponse.json({ ok: true, note: 'onbekend verzenddomein' })
  }

  await db
    .insert(suppressions)
    .values({
      tenantId: tenant.id,
      emailHash: hashEmail(recipient),
      reason: isComplaint ? 'complaint' : 'bounce',
    })
    .onConflictDoNothing()

  console.log(`[webhook] ${event.type} tenant=${tenant.id}`)

  return NextResponse.json({ ok: true })
}
