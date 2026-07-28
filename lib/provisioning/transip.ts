import crypto from 'crypto'

const API = 'https://api.transip.nl/v6'

export interface DnsRecord {
  type: string
  name: string
  value: string
  ttl?: number
  priority?: number
}

/** Eén regel in de zone, zoals TransIP hem teruggeeft. */
interface TransipEntry {
  name: string
  expire: number
  type: string
  content: string
}

/**
 * Het geregistreerde domein waar de zone onder valt.
 *
 * De API werkt per geregistreerd domein, niet per verzendsubdomein: records
 * voor `kvik.send.reviewmoment.nl` schrijf je in de zone `reviewmoment.nl`.
 * Standaard nemen we de laatste twee labels van SENDING_ROOT_DOMAIN, wat klopt
 * voor .nl en .com. Bij een tweeledige extensie (.co.uk) klopt dat niet, en
 * dan zet je TRANSIP_DOMAIN expliciet.
 */
export function registeredDomain(sendingRoot: string, override?: string): string {
  if (override) return override
  const labels = sendingRoot.split('.').filter(Boolean)
  return labels.slice(-2).join('.')
}

/**
 * TransIP wil namen relatief aan de zone, precies zoals het controlepaneel:
 * `resend._domainkey.kvik.send.reviewmoment.nl` wordt `resend._domainkey.kvik.send`.
 *
 * De invoer komt in twee vormen binnen. Resend levert namen al relatief aan het
 * geregistreerde domein (`resend._domainkey.kvik.send`), terwijl het DMARC-record
 * dat we er zelf bijzetten volledig is. Beide worden hier geaccepteerd.
 *
 * `mustBeUnder` is de vangrail en is niet optioneel bedoeld: elk record hoort
 * binnen het verzendsubdomein van één klant te vallen. Zonder die controle kan
 * een verkeerd samengestelde naam op de root van de zone belanden — daar staan
 * de MX en SPF van de eigen zakelijke mail.
 */
export function toZoneName(name: string, zone: string, mustBeUnder: string): string {
  const raw = name.replace(/\.$/, '')
  const absolute = raw === zone || raw.endsWith(`.${zone}`) ? raw : `${raw}.${zone}`

  if (absolute !== mustBeUnder && !absolute.endsWith(`.${mustBeUnder}`)) {
    throw new Error(`Record "${raw}" valt buiten "${mustBeUnder}"`)
  }

  if (absolute === zone) return '@'
  return absolute.slice(0, -(zone.length + 1))
}

/** MX draagt zijn prioriteit in het inhoudsveld: "10 host.example.com". */
export function toContent(record: DnsRecord): string {
  if (record.type === 'MX' && record.priority !== undefined) {
    return `${record.priority} ${record.value}`
  }
  return record.value
}

function config() {
  const login = process.env.TRANSIP_LOGIN
  const key = process.env.TRANSIP_PRIVATE_KEY
  if (!login || !key) {
    throw new Error('TRANSIP_LOGIN of TRANSIP_PRIVATE_KEY ontbreekt')
  }
  // In een omgevingsvariabele staan de regeleindes vaak als \n-tekens.
  return { login, key: key.replace(/\\n/g, '\n') }
}

let cached: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const { login, key } = config()

  const body = JSON.stringify({
    login,
    nonce: crypto.randomBytes(12).toString('hex'),
    read_only: false,
    expiration_time: '30 minutes',
    label: `reviewmoment-${Date.now()}`,
    // Zonder dit bindt TransIP het token aan het IP dat het aanvroeg. Railway
    // heeft geen vast uitgaand IP, dus dat token is bij de volgende call dood.
    global_key: true,
  })

  // De handtekening gaat over exact deze bytes, dus body mag hierna niet meer
  // opnieuw geserialiseerd worden.
  const signature = crypto.createSign('sha512').update(body).sign(key, 'base64')

  const res = await fetch(`${API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Signature: signature },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TransIP-authenticatie mislukt (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as { token: string }
  cached = { token: json.token, expiresAt: Date.now() + 25 * 60_000 }
  return json.token
}

async function tp<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TransIP-fout (${res.status}) op ${path}: ${text.slice(0, 200)}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function zone(): string {
  const root = process.env.SENDING_ROOT_DOMAIN
  if (!root) throw new Error('SENDING_ROOT_DOMAIN ontbreekt')
  return registeredDomain(root, process.env.TRANSIP_DOMAIN)
}

/** Leest de hele zone. Ook gebruikt door de preflight om de toegang te toetsen. */
export async function listZone(domain: string): Promise<TransipEntry[]> {
  const json = await tp<{ dnsEntries: TransipEntry[] }>(`/domains/${domain}/dns`)
  return json.dnsEntries || []
}

/**
 * Schrijft één record weg.
 *
 * Bewust verwijderen-en-opnieuw-aanmaken in plaats van PATCH: PATCH matcht op
 * de bestaande inhoud, dus bij een gewijzigde DKIM-sleutel weet hij niet welke
 * regel hij moet bijwerken. Er is ook een PUT die de hele zone vervangt — die
 * raken we niet aan, want daarmee vaag je bij één fout de MX en SPF van de
 * zakelijke mail weg.
 */
export async function upsertRecord(record: DnsRecord, mustBeUnder: string): Promise<void> {
  const domain = zone()
  const name = toZoneName(record.name, domain, mustBeUnder)
  const content = toContent(record)
  const expire = record.ttl ?? 3600

  const existing = await listZone(domain)
  const conflicts = existing.filter((e) => e.name === name && e.type === record.type)

  for (const entry of conflicts) {
    if (entry.content === content && entry.expire === expire) return // al goed
    await tp(`/domains/${domain}/dns`, {
      method: 'DELETE',
      body: JSON.stringify({ dnsEntry: entry }),
    })
  }

  await tp(`/domains/${domain}/dns`, {
    method: 'POST',
    body: JSON.stringify({ dnsEntry: { name, expire, type: record.type, content } }),
  })
}

export async function upsertRecords(records: DnsRecord[], mustBeUnder: string): Promise<void> {
  // Serieel: de zone wordt per aanroep opnieuw gelezen, dus parallel schrijven
  // laat de een de wijziging van de ander overschrijven.
  for (const record of records) {
    await upsertRecord(record, mustBeUnder)
  }
}

/** Ruimt alle records van één klant op, bijvoorbeeld bij opzeggen. */
export async function deleteRecordsForSubdomain(
  subdomain: string,
  rootDomain: string
): Promise<void> {
  const domain = zone()
  const under = `${subdomain}.${rootDomain}`
  const suffix = toZoneName(under, domain, under)

  for (const entry of await listZone(domain)) {
    if (entry.name === suffix || entry.name.endsWith(`.${suffix}`)) {
      await tp(`/domains/${domain}/dns`, {
        method: 'DELETE',
        body: JSON.stringify({ dnsEntry: entry }),
      })
    }
  }
}
