import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * De POC gebruikte een in-memory Map. Op Vercel draait elke serverless
 * instantie in zijn eigen geheugen, dus die limiter telde per instantie —
 * bij vier gelijktijdige instanties liet een limiet van 5 er in de praktijk
 * 20 door, en na een cold start begon de telling weer bij nul. Een limiter
 * die je niet kunt vertrouwen is erger dan geen limiter, want je denkt dat
 * je beschermd bent.
 *
 * Upstash Redis is gedeeld over alle instanties, dus de telling klopt wel.
 */

// Lazy geïnitialiseerd: tijdens de build laadt Next elke route-module in, en
// die mag niet omvallen op een ontbrekende Redis-configuratie.
let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis is niet geconfigureerd')

  _redis = new Redis({ url, token })
  return _redis
}

function makeLimiter(prefix: string, requests: number) {
  let instance: Ratelimit | null = null
  return {
    limit(identifier: string) {
      if (!instance) {
        instance = new Ratelimit({
          redis: getRedis(),
          limiter: Ratelimit.slidingWindow(requests, '1 m'),
          prefix,
          analytics: false,
        })
      }
      return instance.limit(identifier)
    },
  }
}

// Inloggen: strak, per IP. Beschermt tegen credential stuffing.
export const loginLimiter = makeLimiter('rl:login', 5)

// Extractie: kost Anthropic-tokens, dus per tenant begrenzen — niet per IP.
// Een tenant met vijf medewerkers achter één kantoor-IP moet niet elkaars
// limiet opeten, en één tenant mag niet je hele token-budget opmaken.
export const extractLimiter = makeLimiter('rl:extract', 20)

// Aanmaken van verzendopdrachten: per tenant, ruim maar niet ongelimiteerd.
export const sendLimiter = makeLimiter('rl:send', 10)

/**
 * Maandelijks e-mailquotum per tenant. Losstaand van rate limiting: dit
 * beschermt je Resend-kosten en beperkt de schade als een klant per ongeluk
 * een veel te grote lijst upload.
 */
export async function consumeMonthlyQuota(
  tenantId: string,
  amount: number,
  limit: number
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  const key = `quota:${tenantId}:${month}`

  const redis = getRedis()
  const used = await redis.incrby(key, amount)

  // TTL alleen zetten bij de eerste increment van de maand.
  if (used === amount) {
    await redis.expire(key, 60 * 60 * 24 * 40)
  }

  if (used > limit) {
    // Terugdraaien: deze batch gaat niet door, dus mag hij niet meetellen.
    await redis.decrby(key, amount)
    const current = used - amount
    return { allowed: false, used: current, remaining: Math.max(0, limit - current) }
  }

  return { allowed: true, used, remaining: Math.max(0, limit - used) }
}

export async function releaseQuota(tenantId: string, amount: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)
  await getRedis().decrby(`quota:${tenantId}:${month}`, amount)
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}
