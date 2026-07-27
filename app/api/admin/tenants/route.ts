import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants, users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { subdomainFor, rootDomain, provisionSendingDomain } from '@/lib/provisioning/domain'

export const runtime = 'nodejs'

const RESERVED = new Set(['www', 'mail', 'admin', 'api', 'app', 'smtp', 'dmarc', 'bounce'])

/**
 * Een nieuwe klant aanmaken.
 *
 * In de POC stonden gebruikers in een JSON-blob in de USERS-omgevingsvariabele.
 * Elke nieuwe klant betekende dus: env var aanpassen, opnieuw deployen, en
 * hopen dat de JSON klopt — één ontbrekende komma en iedereen kon niet meer
 * inloggen. Dat schaalt niet en past niet bij "makkelijk onboarden".
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 403 })
  }

  let body: {
    businessName?: string
    googleReviewLink?: string
    email?: string
    subdomain?: string
    fromName?: string
    replyTo?: string
    monthlyEmailLimit?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  const businessName = body.businessName?.trim()
  const googleReviewLink = body.googleReviewLink?.trim()
  const email = body.email?.trim().toLowerCase()
  const replyTo = body.replyTo?.trim().toLowerCase()

  if (!businessName || !googleReviewLink || !email || !replyTo) {
    return NextResponse.json(
      { error: 'Bedrijfsnaam, reviewlink, e-mailadres en reply-to zijn verplicht.' },
      { status: 400 }
    )
  }

  // De reviewlink moet naar Google wijzen. Zonder deze controle kan een typefout
  // ertoe leiden dat een hele klantenlijst naar een dode of verkeerde pagina
  // wordt gestuurd, en dat merk je pas als de reviews uitblijven.
  let host: string
  try {
    host = new URL(googleReviewLink).hostname
  } catch {
    return NextResponse.json({ error: 'Reviewlink is geen geldige URL.' }, { status: 400 })
  }

  const allowedHosts = ['g.page', 'search.google.com', 'www.google.com', 'maps.app.goo.gl', 'goo.gl']
  if (!allowedHosts.includes(host)) {
    return NextResponse.json(
      { error: 'Reviewlink moet een Google-reviewlink zijn (bijvoorbeeld g.page/r/...).' },
      { status: 400 }
    )
  }

  const subdomain = (body.subdomain?.trim().toLowerCase() || subdomainFor(businessName))
    .replace(/[^a-z0-9-]/g, '')

  if (!subdomain || RESERVED.has(subdomain) || subdomain.length < 3) {
    return NextResponse.json({ error: 'Ongeldig of gereserveerd subdomein.' }, { status: 400 })
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik.' }, { status: 409 })
  }

  const sendingDomain = `${subdomain}.${rootDomain()}`

  // Wachtwoord genereren in plaats van laten kiezen: het wordt één keer
  // getoond en daarna alleen als hash bewaard.
  const tempPassword = crypto.randomBytes(9).toString('base64url')
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  try {
    const tenantId = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          businessName,
          googleReviewLink,
          subdomain,
          sendingDomain,
          fromName: body.fromName?.trim() || businessName,
          replyTo,
          monthlyEmailLimit: body.monthlyEmailLimit ?? 2000,
          domainStatus: 'pending',
        })
        .returning({ id: tenants.id })

      await tx.insert(users).values({
        tenantId: tenant.id,
        email,
        passwordHash,
        role: 'owner',
      })

      return tenant.id
    })

    // Provisioning mag falen zonder de klant kwijt te raken: de tenant staat
    // er, het domein blijft 'pending' en je kunt het opnieuw aanzetten.
    let domainStatus = 'pending'
    let provisioningError: string | null = null
    try {
      const result = await provisionSendingDomain(tenantId)
      domainStatus = result.status
    } catch (err) {
      provisioningError = err instanceof Error ? err.message : 'onbekende fout'
      console.error(`[admin] provisioning mislukt voor tenant=${tenantId}`, provisioningError)
    }

    return NextResponse.json({
      tenantId,
      sendingDomain,
      domainStatus,
      provisioningError,
      email,
      tempPassword, // enige moment waarop dit zichtbaar is
    })
  } catch (err) {
    console.error('[admin] aanmaken mislukt', err instanceof Error ? err.message : '')
    return NextResponse.json({ error: 'Kon de klant niet aanmaken.' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 403 })
  }

  const rows = await db
    .select({
      id: tenants.id,
      businessName: tenants.businessName,
      sendingDomain: tenants.sendingDomain,
      domainStatus: tenants.domainStatus,
      active: tenants.active,
      monthlyEmailLimit: tenants.monthlyEmailLimit,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(tenants.createdAt)

  return NextResponse.json({ tenants: rows })
}
