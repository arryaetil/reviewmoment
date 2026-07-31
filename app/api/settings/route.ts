import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'

/** Hosts waarop een Google-reviewlink kan staan. */
const REVIEW_HOSTS = ['g.page', 'search.google.com', 'www.google.com', 'maps.app.goo.gl', 'goo.gl']

/**
 * Instellingen die een klant zelf mag wijzigen.
 *
 * Bewust een korte lijst. Het verzenddomein, het subdomein, de domeinstatus en
 * de maandlimiet staan er niet in: die horen bij de provisioning en bij wat er
 * is afgesproken, niet bij wat een gebruiker even kan omzetten. De query
 * filtert op de tenant uit de sessie, dus niemand kan andermans gegevens raken.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  let body: { fromName?: string; replyTo?: string; googleReviewLink?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  const fromName = body.fromName?.trim()
  const replyTo = body.replyTo?.trim().toLowerCase()
  const googleReviewLink = body.googleReviewLink?.trim()

  if (!fromName || !replyTo || !googleReviewLink) {
    return NextResponse.json(
      { error: 'Afzendernaam, antwoordadres en reviewlink zijn alle drie verplicht.' },
      { status: 400 }
    )
  }

  /*
   * De afzendernaam belandt in een e-mailheader. Een regeleinde erin betekent
   * dat iemand vanuit dit veld een extra header kan toevoegen — een Bcc naar
   * zichzelf bijvoorbeeld. Vandaar dat regeleindes hier hard geweigerd worden
   * in plaats van stilletjes weggepoetst: dan weet de gebruiker ook waarom.
   */
  if (/[\r\n]/.test(fromName)) {
    return NextResponse.json({ error: 'De afzendernaam mag geen regeleindes bevatten.' }, { status: 400 })
  }

  if (fromName.length > 60) {
    return NextResponse.json(
      { error: 'De afzendernaam mag hooguit 60 tekens zijn; langer kapt de inbox hem af.' },
      { status: 400 }
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    return NextResponse.json({ error: 'Vul een geldig antwoordadres in.' }, { status: 400 })
  }

  // Een typefout in de reviewlink stuurt een hele klantenlijst naar een dode
  // pagina, en dat merk je pas als de reviews uitblijven.
  let host: string
  try {
    host = new URL(googleReviewLink).hostname
  } catch {
    return NextResponse.json({ error: 'De reviewlink is geen geldige URL.' }, { status: 400 })
  }

  if (!REVIEW_HOSTS.includes(host)) {
    return NextResponse.json(
      { error: 'De reviewlink moet naar Google wijzen, bijvoorbeeld g.page/r/…' },
      { status: 400 }
    )
  }

  await db
    .update(tenants)
    .set({ fromName, replyTo, googleReviewLink, updatedAt: new Date() })
    .where(eq(tenants.id, session.tenant.id))

  // Geen waarden loggen: hier staan bedrijfsnaam en e-mailadres in.
  console.log(`[settings] bijgewerkt voor tenant=${session.tenant.id}`)

  return NextResponse.json({ fromName, replyTo, googleReviewLink })
}
