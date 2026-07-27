import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, tenants } from '@/lib/db/schema'
import { createToken, TOKEN_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { loginLimiter, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Vaste hash om tegen te vergelijken als het account niet bestaat. Zonder dit
// keert een onbekend e-mailadres direct terug en een bestaand adres pas na de
// bcrypt-vergelijking — dat tijdsverschil verraadt welke adressen klant zijn.
const DUMMY_HASH = '$2b$12$xxxxxxxxxxxxxxxxxxxxxuNVKGrN0kmDvbrIrIDbQMrRRVHFRXHe'

export async function POST(req: NextRequest) {
  const { success } = await loginLimiter.limit(clientIp(req))
  if (!success) {
    return NextResponse.json(
      { error: 'Te veel inlogpogingen. Probeer over een minuut opnieuw.' },
      { status: 429 }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail en wachtwoord zijn verplicht.' }, { status: 400 })
  }

  const rows = await db
    .select({ user: users, tenantActive: tenants.active })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.email, email))
    .limit(1)

  const row = rows[0]

  const match = await bcrypt.compare(password, row?.user.passwordHash ?? DUMMY_HASH)

  // Eén generieke foutmelding voor alle gevallen: onbekend adres, verkeerd
  // wachtwoord en gedeactiveerde tenant zijn van buitenaf niet te onderscheiden.
  if (!row || !match || !row.tenantActive) {
    return NextResponse.json({ error: 'Ongeldige inloggegevens.' }, { status: 401 })
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, row.user.id))

  const token = await createToken({
    userId: row.user.id,
    tenantId: row.user.tenantId,
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set(TOKEN_NAME, token, COOKIE_OPTIONS)
  return response
}
