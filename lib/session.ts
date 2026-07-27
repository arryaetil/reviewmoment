import { cookies } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { db } from './db'
import { tenants, users, type Tenant, type User } from './db/schema'
import { verifyToken, TOKEN_NAME } from './auth'

export interface Session {
  user: User
  tenant: Tenant
}

/**
 * Haalt de ingelogde gebruiker plus tenant op uit de database.
 *
 * Alleen te gebruiken in route handlers en server components (Node runtime),
 * niet in middleware — die draait op de Edge en heeft geen databaseverbinding.
 */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(TOKEN_NAME)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const rows = await db
    .select({ user: users, tenant: tenants })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(eq(users.id, payload.userId), eq(users.tenantId, payload.tenantId)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  // Een gedeactiveerde tenant houdt een geldig token, maar mag niets meer.
  if (!row.tenant.active) return null

  return { user: row.user, tenant: row.tenant }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new UnauthorizedError()
  return session
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Niet geautoriseerd')
    this.name = 'UnauthorizedError'
  }
}
