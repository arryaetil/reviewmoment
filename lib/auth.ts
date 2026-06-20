import { SignJWT, jwtVerify } from 'jose'

export interface UserConfig {
  email: string
  password: string
  businessName: string
  googleReviewLink: string
  fromDomain: string
  fromName: string
  replyTo: string
}

export interface JWTPayload {
  email: string
  businessName: string
  googleReviewLink: string
  fromDomain: string
  fromName: string
  replyTo: string
}

const JWT_SECRET_KEY = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')
const TOKEN_NAME = 'cloudcast_token'
const EXPIRY = '24h'

export function getUsers(): UserConfig[] {
  const raw = process.env.USERS
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(JWT_SECRET_KEY())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export { TOKEN_NAME }
