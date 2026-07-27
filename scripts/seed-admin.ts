/**
 * Maakt de eerste admin aan. Draaien met:
 *   npx tsx scripts/seed-admin.ts <email> <wachtwoord>
 *
 * De admin hangt aan een interne tenant die zelf niets verstuurt; die bestaat
 * alleen omdat elke gebruiker aan een tenant gekoppeld is. Vanaf hier maak je
 * klanten aan via /api/admin/tenants — zonder redeploy.
 */
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { tenants, users } from '../lib/db/schema'

async function main() {
  const [email, password] = process.argv.slice(2)

  if (!email || !password) {
    console.error('Gebruik: npx tsx scripts/seed-admin.ts <email> <wachtwoord>')
    process.exit(1)
  }

  if (password.length < 12) {
    console.error('Kies een wachtwoord van minstens 12 tekens.')
    process.exit(1)
  }

  const normalized = email.trim().toLowerCase()

  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1)
  if (existing.length > 0) {
    console.error('Dit e-mailadres bestaat al.')
    process.exit(1)
  }

  let [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.subdomain, '__admin'))
    .limit(1)

  if (!tenant) {
    const [createdTenant] = await db
      .insert(tenants)
      .values({
        businessName: 'Platformbeheer',
        googleReviewLink: 'https://g.page/r/placeholder',
        subdomain: '__admin',
        sendingDomain: '__admin.invalid',
        fromName: 'Platformbeheer',
        replyTo: normalized,
        domainStatus: 'pending',
        active: true,
      })
      .returning({ id: tenants.id })
    tenant = createdTenant
  }

  await db.insert(users).values({
    tenantId: tenant.id,
    email: normalized,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'admin',
  })

  console.log(`Admin aangemaakt: ${normalized}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
