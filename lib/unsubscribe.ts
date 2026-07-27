import crypto from 'crypto'

/**
 * Uitschrijflinks zijn ondertekend in plaats van opgeslagen: uit de link zelf
 * valt af te leiden om welke tenant en welk adres het gaat, en de HMAC maakt
 * knoeien onmogelijk. Zo hoeven we geen extra tabel met tokens bij te houden
 * die zelf weer persoonsgegevens bevat.
 */

function key(): Buffer {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('UNSUBSCRIBE_SECRET ontbreekt of is te kort')
  }
  return Buffer.from(s)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function createUnsubscribeToken(tenantId: string, email: string): string {
  const payload = b64url(JSON.stringify({ t: tenantId, e: normalizeEmail(email) }))
  const sig = b64url(crypto.createHmac('sha256', key()).update(payload).digest())
  return `${payload}.${sig}`
}

export function verifyUnsubscribeToken(
  token: string
): { tenantId: string; email: string } | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const expected = crypto.createHmac('sha256', key()).update(payload).digest()
  const given = fromB64url(sig)

  if (given.length !== expected.length) return null
  if (!crypto.timingSafeEqual(given, expected)) return null

  try {
    const parsed = JSON.parse(fromB64url(payload).toString('utf8'))
    if (typeof parsed.t !== 'string' || typeof parsed.e !== 'string') return null
    return { tenantId: parsed.t, email: parsed.e }
  } catch {
    return null
  }
}

export function unsubscribeUrl(tenantId: string, email: string): string {
  const base = process.env.APP_URL
  if (!base) throw new Error('APP_URL ontbreekt')
  return `${base.replace(/\/$/, '')}/u/${createUnsubscribeToken(tenantId, email)}`
}
