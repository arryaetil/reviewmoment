/**
 * Controleert of alle externe diensten bereikbaar en juist geconfigureerd zijn.
 *
 *   npx tsx scripts/preflight.ts
 *
 * Bedoeld om te draaien na het invullen van .env.local en na elke wijziging in
 * de omgevingsvariabelen op Vercel. Zonder deze controle ontdek je een verkeerd
 * gekopieerde sleutel pas op het moment dat een klant iets probeert te
 * versturen — en dan is de fout die je ziet zelden de fout die het is.
 */

type Result = { name: string; ok: boolean; detail: string }

const results: Result[] = []

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail })
}

function env(key: string): string | undefined {
  const v = process.env[key]
  return v && v.trim() ? v.trim() : undefined
}

// ---------------------------------------------------------------------------

function checkEnvVars() {
  const required = [
    'APP_URL',
    'JWT_SECRET',
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'RESEND_API_KEY',
    'SENDING_ROOT_DOMAIN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ZONE_ID',
    'REDIS_URL',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
  ]

  const missing = required.filter((k) => !env(k))
  record(
    'Omgevingsvariabelen',
    missing.length === 0,
    missing.length === 0 ? `${required.length} aanwezig` : `ontbreekt: ${missing.join(', ')}`
  )

  const secret = env('JWT_SECRET')
  if (secret) {
    record(
      'JWT_SECRET',
      secret.length >= 32,
      secret.length >= 32 ? `${secret.length} tekens` : `te kort (${secret.length}, minimaal 32)`
    )
  }

  const appUrl = env('APP_URL')
  if (appUrl) {
    // De worker en de afmeldlinks gebruiken deze URL. Staat hier localhost,
    // dan kan QStash je endpoint niet bereiken en blijft elke job hangen.
    const ok = appUrl.startsWith('https://') && !appUrl.includes('localhost')
    record('APP_URL', ok, ok ? appUrl : `moet een publieke https-URL zijn, nu: ${appUrl}`)
  }

  const missingWebhook = !env('RESEND_WEBHOOK_SECRET')
  if (missingWebhook) {
    record(
      'RESEND_WEBHOOK_SECRET',
      false,
      'ontbreekt — bounces en spamklachten komen dan niet op de suppressielijst'
    )
  }
}

async function checkDatabase() {
  const url = env('DATABASE_URL')
  if (!url) return record('Supabase', false, 'DATABASE_URL ontbreekt')

  try {
    const { default: postgres } = await import('postgres')
    const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 })

    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
    `
    await sql.end()

    const names = tables.map((t) => t.table_name)
    const expected = ['tenants', 'users', 'send_jobs', 'send_job_recipients', 'suppressions']
    const absent = expected.filter((t) => !names.includes(t))

    record(
      'Supabase',
      absent.length === 0,
      absent.length === 0
        ? `verbonden, ${expected.length} tabellen aanwezig`
        : `verbonden, maar tabellen ontbreken: ${absent.join(', ')} — draai npm run db:migrate`
    )
  } catch (err) {
    record('Supabase', false, err instanceof Error ? err.message : 'verbinding mislukt')
  }
}

async function checkRedis() {
  const url = env('REDIS_URL')
  if (!url) return record('Railway Redis', false, 'REDIS_URL ontbreekt')

  try {
    const { createClient } = await import('redis')
    const redis = createClient({ url })
    await redis.connect()
    const result = await redis.ping()
    await redis.quit()
    record('Railway Redis', result === 'PONG', result)
  } catch (err) {
    record('Railway Redis', false, err instanceof Error ? err.message : 'onbereikbaar')
  }
}

async function checkQStash() {
  const token = env('QSTASH_TOKEN')
  if (!token) return record('QStash', false, 'QSTASH_TOKEN ontbreekt')

  try {
    const res = await fetch('https://qstash.upstash.io/v2/schedules', {
      headers: { Authorization: `Bearer ${token}` },
    })
    record('QStash', res.ok, res.ok ? 'token geldig' : `HTTP ${res.status}`)
  } catch (err) {
    record('QStash', false, err instanceof Error ? err.message : 'onbereikbaar')
  }
}

async function checkResend() {
  const key = env('RESEND_API_KEY')
  if (!key) return record('Resend', false, 'RESEND_API_KEY ontbreekt')

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return record('Resend', false, `HTTP ${res.status}`)

    const json = (await res.json()) as { data?: { name: string; status: string }[] }
    const domains = json.data ?? []
    record(
      'Resend',
      true,
      domains.length === 0
        ? 'verbonden, nog geen domeinen (normaal voordat je de eerste klant aanmaakt)'
        : `verbonden, ${domains.length} domein(en): ${domains.map((d) => `${d.name} (${d.status})`).join(', ')}`
    )
  } catch (err) {
    record('Resend', false, err instanceof Error ? err.message : 'onbereikbaar')
  }
}

async function checkCloudflare() {
  const token = env('CLOUDFLARE_API_TOKEN')
  const zoneId = env('CLOUDFLARE_ZONE_ID')
  const root = env('SENDING_ROOT_DOMAIN')
  if (!token || !zoneId) return record('Cloudflare', false, 'token of zone id ontbreekt')

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = (await res.json()) as {
      success: boolean
      result?: { name: string; status: string }
      errors?: { message: string }[]
    }

    if (!json.success) {
      return record('Cloudflare', false, json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`)
    }

    const zone = json.result!

    // De zone moet het verzenddomein kunnen bevatten, anders schrijft de
    // provisioning records weg in een zone die niets met je mail te maken heeft.
    const covers = root ? root === zone.name || root.endsWith(`.${zone.name}`) : false

    record(
      'Cloudflare',
      covers && zone.status === 'active',
      !covers
        ? `zone is ${zone.name}, maar SENDING_ROOT_DOMAIN is ${root} — die valt daar niet onder`
        : zone.status !== 'active'
          ? `zone ${zone.name} staat op "${zone.status}" — nameservers nog niet omgezet bij TransIP?`
          : `zone ${zone.name} actief, dekt ${root}`
    )
  } catch (err) {
    record('Cloudflare', false, err instanceof Error ? err.message : 'onbereikbaar')
  }
}

async function checkAnthropic() {
  const key = env('ANTHROPIC_API_KEY')
  if (!key) return record('Anthropic', false, 'ANTHROPIC_API_KEY ontbreekt')

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    record('Anthropic', res.ok, res.ok ? 'sleutel geldig' : `HTTP ${res.status}`)
  } catch (err) {
    record('Anthropic', false, err instanceof Error ? err.message : 'onbereikbaar')
  }
}

// ---------------------------------------------------------------------------

async function main() {
  checkEnvVars()

  await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQStash(),
    checkResend(),
    checkCloudflare(),
    checkAnthropic(),
  ])

  const width = Math.max(...results.map((r) => r.name.length))
  console.log('')
  for (const r of results) {
    console.log(`${r.ok ? '  ok ' : ' FOUT'}  ${r.name.padEnd(width)}  ${r.detail}`)
  }

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(
    failed.length === 0
      ? 'Alles staat goed. Je kunt de eerste klant aanmaken via POST /api/admin/tenants.'
      : `${failed.length} van de ${results.length} controles vraagt aandacht.`
  )

  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
