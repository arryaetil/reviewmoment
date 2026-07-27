const API = 'https://api.cloudflare.com/client/v4'

export interface DnsRecord {
  type: string
  name: string
  value: string
  ttl?: number
  priority?: number
}

function config() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zoneId) {
    throw new Error('CLOUDFLARE_API_TOKEN of CLOUDFLARE_ZONE_ID ontbreekt')
  }
  return { token, zoneId }
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, zoneId } = config()
  const res = await fetch(`${API}/zones/${zoneId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const json = (await res.json()) as { success: boolean; result: T; errors?: { message: string }[] }

  if (!json.success) {
    throw new Error(json.errors?.map((e) => e.message).join('; ') || `Cloudflare fout (${res.status})`)
  }

  return json.result
}

/**
 * Schrijft één DNS-record weg. Bestaat het record al met dezelfde naam en type,
 * dan wordt het bijgewerkt — zo is opnieuw provisionen veilig.
 */
export async function upsertRecord(record: DnsRecord): Promise<void> {
  const name = record.name.replace(/\.$/, '')

  const existing = await cf<{ id: string; name: string; type: string }[]>(
    `/dns_records?type=${encodeURIComponent(record.type)}&name=${encodeURIComponent(name)}`
  )

  const body = JSON.stringify({
    type: record.type,
    name,
    content: record.value,
    ttl: record.ttl ?? 3600,
    ...(record.priority !== undefined ? { priority: record.priority } : {}),
    // Nooit proxyen: mailrecords moeten rechtstreeks resolven.
    proxied: false,
  })

  if (existing.length > 0) {
    await cf(`/dns_records/${existing[0].id}`, { method: 'PUT', body })
  } else {
    await cf('/dns_records', { method: 'POST', body })
  }
}

export async function upsertRecords(records: DnsRecord[]): Promise<void> {
  // Serieel: Cloudflare knijpt parallelle schrijfacties op dezelfde zone af.
  for (const record of records) {
    await upsertRecord(record)
  }
}

export async function deleteRecordsForSubdomain(subdomain: string, rootDomain: string): Promise<void> {
  const suffix = `${subdomain}.${rootDomain}`
  const all = await cf<{ id: string; name: string }[]>('/dns_records?per_page=500')

  for (const record of all) {
    if (record.name === suffix || record.name.endsWith(`.${suffix}`)) {
      await cf(`/dns_records/${record.id}`, { method: 'DELETE' })
    }
  }
}
