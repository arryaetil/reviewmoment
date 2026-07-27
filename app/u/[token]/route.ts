import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { suppressions } from '@/lib/db/schema'
import { verifyUnsubscribeToken, hashEmail } from '@/lib/unsubscribe'

export const runtime = 'nodejs'

async function suppress(token: string): Promise<boolean> {
  const parsed = verifyUnsubscribeToken(token)
  if (!parsed) return false

  await db
    .insert(suppressions)
    .values({
      tenantId: parsed.tenantId,
      emailHash: hashEmail(parsed.email),
      reason: 'unsubscribe',
    })
    .onConflictDoNothing()

  return true
}

/** One-click afmelden vanuit de mailclient (List-Unsubscribe-Post). */
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const ok = await suppress(params.token)
  return new NextResponse(null, { status: ok ? 200 : 400 })
}

/** Afmelden via de link in de e-mail. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const ok = await suppress(params.token)

  const body = ok
    ? `<h1>U bent afgemeld</h1><p>U ontvangt geen reviewverzoeken meer van dit bedrijf.</p>`
    : `<h1>Link niet geldig</h1><p>Deze afmeldlink is verlopen of onjuist. Antwoord op de e-mail als het niet lukt.</p>`

  return new NextResponse(
    `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afmelden</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#1a1a1a;line-height:1.6">${body}</body></html>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}
