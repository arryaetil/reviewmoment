import { SignJWT, jwtVerify } from 'jose'

export const TOKEN_NAME = 'session'
const EXPIRY = '12h'

/**
 * De JWT bevat bewust alleen identifiers — geen bedrijfsnaam, reviewlink of
 * verzenddomein. Die worden per request uit de database gelezen.
 *
 * Reden: in de POC stond de volledige tenantconfig in het token en werd die
 * via x-user-* headers doorgegeven aan de API-routes. Dat betekent dat een
 * route de afzender vertrouwt op basis van iets wat buiten die route om is
 * gezet. Zodra één pad de middleware-matcher ontglipt, of er een proxy voor
 * staat die client-headers doorlaat, kan een gebruiker zijn eigen afzender
 * kiezen. Met alleen een tenantId in het token bestaat die klasse bugs niet.
 */
export interface SessionPayload {
  userId: string
  tenantId: string
}

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET ontbreekt of is korter dan 32 tekens')
  }
  return new TextEncoder().encode(s)
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.userId !== 'string' || typeof payload.tenantId !== 'string') {
      return null
    }
    return { userId: payload.userId, tenantId: payload.tenantId }
  } catch {
    return null
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 12,
}
