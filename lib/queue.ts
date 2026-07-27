import { Client } from '@upstash/qstash'

const token = process.env.QSTASH_TOKEN
export const qstash = token ? new Client({ token }) : null

export function workerUrl(path: string): string {
  const base = process.env.APP_URL
  if (!base) throw new Error('APP_URL ontbreekt')
  return `${base.replace(/\/$/, '')}${path}`
}

export interface ProcessJobMessage {
  jobId: string
  /** Index van de batch binnen de job; de worker plant zelf de volgende in. */
  batch: number
}

/**
 * Zet een verzendopdracht in de wachtrij.
 *
 * QStash levert minimaal één keer af, dus de worker moet idempotent zijn:
 * die markeert ontvangers per stuk als verstuurd en slaat al verstuurde
 * adressen over bij een herlevering.
 */
export async function enqueueJob(message: ProcessJobMessage, delaySeconds = 0) {
  if (!qstash) {
    throw new Error('QSTASH_TOKEN ontbreekt — verzenden is niet geconfigureerd')
  }

  return qstash.publishJSON({
    url: workerUrl('/api/jobs/process'),
    body: message,
    delay: delaySeconds,
    retries: 3,
  })
}
