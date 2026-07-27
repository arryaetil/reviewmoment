import { normalizeEmail } from './unsubscribe'
import type { Contact } from './types'

export interface Recipient {
  email: string
  name: string | null
}

export interface PrepareResult {
  recipients: Recipient[]
  skippedInvalid: number
  skippedDuplicate: number
}

/**
 * Deze regex is bewust conservatief. Hij laat geldige maar exotische adressen
 * vallen in plaats van ongeldige door te laten: een adres dat we ten onrechte
 * overslaan kost één review, een adres dat bounced kost verzendreputatie voor
 * alle klanten op dat domein.
 */
const EMAIL_RE = /^[^\s@,;:<>()[\]\\"]+@[^\s@,;:<>()[\]\\"]+\.[a-z]{2,}$/i

export const MAX_NAME_LENGTH = 120

/**
 * Zet de door Claude geëxtraheerde contacten om in een verzendlijst.
 *
 * Apart van de route gehouden zodat dit testbaar is zonder database, Redis of
 * sessie. Dit is de plek waar een stille fout het duurst is: een regressie in
 * de ontdubbeling stuurt dezelfde persoon twee keer dezelfde mail.
 */
export function prepareRecipients(contacts: unknown): PrepareResult {
  if (!Array.isArray(contacts)) {
    return { recipients: [], skippedInvalid: 0, skippedDuplicate: 0 }
  }

  const seen = new Set<string>()
  const recipients: Recipient[] = []
  let skippedInvalid = 0
  let skippedDuplicate = 0

  for (const raw of contacts as Contact[]) {
    if (!raw || typeof raw !== 'object') {
      skippedInvalid++
      continue
    }

    // We vertrouwen het `valid`-vlaggetje van het taalmodel niet blind: het
    // komt uit gegenereerde JSON en wordt hier alsnog zelf gecontroleerd.
    if (raw.valid === false || typeof raw.email !== 'string') {
      skippedInvalid++
      continue
    }

    const email = normalizeEmail(raw.email)

    if (!EMAIL_RE.test(email) || email.length > 254) {
      skippedInvalid++
      continue
    }

    if (seen.has(email)) {
      skippedDuplicate++
      continue
    }

    seen.add(email)

    const name =
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
        : null

    recipients.push({ email, name })
  }

  return { recipients, skippedInvalid, skippedDuplicate }
}
