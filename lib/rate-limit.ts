const stores = new Map<string, Map<string, { count: number; reset: number }>>()

export function isRateLimited(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): boolean {
  if (!stores.has(namespace)) stores.set(namespace, new Map())
  const store = stores.get(namespace)!
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return false
  }

  if (entry.count >= maxRequests) return true
  entry.count++
  return false
}
