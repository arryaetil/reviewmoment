import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { upsertRecords, type DnsRecord } from './cloudflare'

const RESEND_API = 'https://api.resend.com'

interface ResendDomain {
  id: string
  name: string
  status: string
  records: {
    record: string
    name: string
    type: string
    value: string
    ttl?: string
    priority?: number
  }[]
}

async function resendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.message || `Resend fout (${res.status})`)
  }
  return json as T
}

/**
 * Zet een subdomein om in een gebruiksklaar verzenddomein.
 *
 * De reden voor een subdomein per klant in plaats van één gedeeld domein:
 * verzendreputatie wordt per domein opgebouwd. Deelt iedereen hetzelfde
 * domein, dan trekt één klant met een verouderde adressenlijst — veel bounces,
 * misschien een spamklacht — alle andere klanten mee de spamfolder in. Met een
 * subdomein per klant blijft die schade bij die ene klant.
 *
 * Een eigen domein per klant zou nog beter isoleren, maar dan moet de klant
 * zelf DNS-records zetten. Dat is precies de drempel die we wilden vermijden.
 */
export function subdomainFor(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .normalize('NFD')
    // Accenten losmaken en weggooien, zodat "Café Zuid" niet "caf-zuid" wordt.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

  return slug || 'klant'
}

export function rootDomain(): string {
  const root = process.env.SENDING_ROOT_DOMAIN
  if (!root) throw new Error('SENDING_ROOT_DOMAIN ontbreekt')
  return root
}

export async function provisionSendingDomain(tenantId: string): Promise<{
  sendingDomain: string
  status: string
}> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  const tenant = rows[0]
  if (!tenant) throw new Error('Tenant niet gevonden')

  const sendingDomain = tenant.sendingDomain

  // 1. Domein aanmelden bij Resend (of het bestaande ophalen).
  let domain: ResendDomain
  try {
    domain = await resendFetch<ResendDomain>('/domains', {
      method: 'POST',
      body: JSON.stringify({ name: sendingDomain, region: 'eu-west-1' }),
    })
  } catch (err) {
    // Bestaat al: opzoeken in plaats van falen, zodat opnieuw draaien veilig is.
    const list = await resendFetch<{ data: ResendDomain[] }>('/domains')
    const found = list.data?.find((d) => d.name === sendingDomain)
    if (!found) throw err
    domain = await resendFetch<ResendDomain>(`/domains/${found.id}`)
  }

  // 2. De door Resend gevraagde records via Cloudflare wegschrijven.
  const records: DnsRecord[] = domain.records.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ttl: r.ttl ? Number(r.ttl) : 3600,
    priority: r.priority,
  }))

  // DMARC hoort er ook bij en levert Resend niet mee. Zonder DMARC-record
  // weigeren grote providers steeds vaker bulkmail. We beginnen op p=none,
  // zodat je eerst rapportage krijgt zonder legitieme mail te blokkeren.
  records.push({
    type: 'TXT',
    name: `_dmarc.${sendingDomain}`,
    value: `v=DMARC1; p=none; rua=mailto:${process.env.DMARC_REPORT_EMAIL || `dmarc@${rootDomain()}`}`,
    ttl: 3600,
  })

  await upsertRecords(records)

  // 3. Verificatie starten. Propagatie duurt even, dus de status blijft
  //    voorlopig 'verifying'; een cron controleert later opnieuw.
  await resendFetch(`/domains/${domain.id}/verify`, { method: 'POST' }).catch(() => null)

  await db
    .update(tenants)
    .set({
      resendDomainId: domain.id,
      domainStatus: 'verifying',
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))

  return { sendingDomain, status: 'verifying' }
}

/** Controleert bij Resend of de DNS-verificatie rond is. */
export async function refreshDomainStatus(tenantId: string): Promise<string> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  const tenant = rows[0]
  if (!tenant?.resendDomainId) return tenant?.domainStatus ?? 'pending'

  const domain = await resendFetch<ResendDomain>(`/domains/${tenant.resendDomainId}`)

  const status =
    domain.status === 'verified'
      ? 'verified'
      : domain.status === 'failed'
        ? 'failed'
        : 'verifying'

  if (status !== tenant.domainStatus) {
    await db
      .update(tenants)
      .set({
        domainStatus: status,
        domainVerifiedAt: status === 'verified' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  }

  return status
}
