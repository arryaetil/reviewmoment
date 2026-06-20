import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { Contact, SendResult } from '@/lib/types'
import { isRateLimited } from '@/lib/rate-limit'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml(name: string, bizName: string, reviewLink: string, replyTo: string): string {
  const n = esc(name), b = esc(bizName)
  return `
<!DOCTYPE html>
<html lang="nl">
<body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 16px">
  <p>Hallo <strong>${n}</strong>,</p>
  <p>Bedankt dat u voor <strong>${b}</strong> heeft gekozen.</p>
  <p>We hopen dat u tevreden bent over onze service. Uw feedback helpt ons om zichtbaar te blijven voor nieuwe klanten en onze dienstverlening verder te verbeteren.</p>
  <p>Zou u een korte Google Review willen achterlaten via onderstaande link?</p>
  <p style="margin:24px 0">
    <a href="${esc(reviewLink)}"
       style="background:#1a44e8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      Review achterlaten
    </a>
  </p>
  <p>Alvast hartelijk bedankt.</p>
  <p>Met vriendelijke groet,<br><strong>${b}</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:11px;color:#999">
    U ontvangt dit bericht omdat u recent klant bent geweest bij ${b}.
    <a href="mailto:${esc(replyTo)}?subject=Uitschrijven">Uitschrijven</a>
  </p>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited('send', ip, 5)) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer over een minuut opnieuw.' }, { status: 429 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'E-mailservice niet geconfigureerd.' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const bizName    = req.headers.get('x-user-business-name') ?? 'Ons bedrijf'
  const reviewLink = req.headers.get('x-user-google-review-link') ?? '#'
  const fromDomain = req.headers.get('x-user-from-domain') ?? ''
  const fromName   = req.headers.get('x-user-from-name') ?? bizName
  const replyTo    = req.headers.get('x-user-reply-to') ?? ''

  const from = `${fromName} <noreply@${fromDomain}>`

  const body = await req.json()
  const contacts: Contact[] = body.contacts

  if (!contacts || !Array.isArray(contacts)) {
    return NextResponse.json({ error: 'Ongeldige contactenlijst' }, { status: 400 })
  }

  const valid = contacts.filter(c => c.valid && c.email)
  if (valid.length === 0) {
    return NextResponse.json({ error: 'Geen geldige e-mailadressen om te versturen' }, { status: 400 })
  }

  if (valid.length > 500) {
    return NextResponse.json({ error: 'Maximaal 500 e-mails per keer' }, { status: 400 })
  }

  const result: SendResult = { sent: 0, failed: 0, errors: [] }

  for (const contact of valid) {
    try {
      await resend.emails.send({
        from,
        to: contact.email,
        reply_to: replyTo,
        subject: `Bedankt voor uw bezoek aan ${bizName}`,
        html: buildHtml(contact.name || 'klant', bizName, reviewLink, replyTo),
      })
      result.sent++
    } catch (err) {
      result.failed++
      console.error(`[send] failed for contact index ${valid.indexOf(contact)}`)
    }
  }

  console.log(`[send] sent=${result.sent} failed=${result.failed}`)

  return NextResponse.json(result)
}
