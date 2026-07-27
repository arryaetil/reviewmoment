import { createClient, type RedisClientType } from 'redis'

let redisPromise: Promise<RedisClientType> | null = null

function getRedis(): Promise<RedisClientType> {
  if (redisPromise) return redisPromise

  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL ontbreekt')

  const client = createClient({ url })
  client.on('error', (err) => console.error('[redis]', err.message))
  redisPromise = client.connect().then(() => client as RedisClientType)
  return redisPromise
}

function makeLimiter(prefix: string, requests: number) {
  return {
    async limit(identifier: string) {
      const redis = await getRedis()
      const minute = Math.floor(Date.now() / 60_000)
      const key = `${prefix}:${identifier}:${minute}`
      const used = await redis.incr(key)
      if (used === 1) await redis.expire(key, 60)
      return { success: used <= requests }
    },
  }
}

export const loginLimiter = makeLimiter('rl:login', 5)
export const extractLimiter = makeLimiter('rl:extract', 20)
export const sendLimiter = makeLimiter('rl:send', 10)

export async function consumeMonthlyQuota(
  tenantId: string,
  amount: number,
  limit: number
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const month = new Date().toISOString().slice(0, 7)
  const key = `quota:${tenantId}:${month}`
  const redis = await getRedis()
  const used = await redis.incrBy(key, amount)

  if (used === amount) await redis.expire(key, 60 * 60 * 24 * 40)

  if (used > limit) {
    await redis.decrBy(key, amount)
    const current = used - amount
    return { allowed: false, used: current, remaining: Math.max(0, limit - current) }
  }

  return { allowed: true, used, remaining: Math.max(0, limit - used) }
}

export async function releaseQuota(tenantId: string, amount: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)
  const redis = await getRedis()
  await redis.decrBy(`quota:${tenantId}:${month}`, amount)
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}
