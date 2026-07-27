import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  hashEmail,
  normalizeEmail,
} from '../lib/unsubscribe'

// De sleutel wordt pas bij het ondertekenen uitgelezen, niet bij het
// importeren, dus het volstaat om hem hier te zetten.
process.env.UNSUBSCRIBE_SECRET = 'test-secret-dat-lang-genoeg-is-voor-hmac-abc'

describe('afmeldtokens', () => {
  const tenant = '11111111-1111-1111-1111-111111111111'

  test('een geldig token levert dezelfde tenant en adres op', () => {
    const token = createUnsubscribeToken(tenant, 'Klant@Voorbeeld.NL')
    const parsed = verifyUnsubscribeToken(token)

    assert.equal(parsed?.tenantId, tenant)
    assert.equal(parsed?.email, 'klant@voorbeeld.nl')
  })

  test('geknoei met de payload wordt geweigerd', () => {
    const token = createUnsubscribeToken(tenant, 'klant@voorbeeld.nl')
    const [payload, sig] = token.split('.')

    // Iemand die zich voor een andere tenant probeert af te melden, of het
    // adres omschrijft, mag geen geldig token kunnen fabriceren.
    const anderePayload = Buffer.from(
      JSON.stringify({ t: '22222222-2222-2222-2222-222222222222', e: 'ander@voorbeeld.nl' })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    assert.equal(verifyUnsubscribeToken(`${anderePayload}.${sig}`), null)
    assert.equal(verifyUnsubscribeToken(`${payload}.${sig.slice(0, -2)}xy`), null)
  })

  test('onzin-invoer geeft null in plaats van een uitzondering', () => {
    for (const bad of ['', '.', 'geen-punt', 'a.b.c', '....']) {
      assert.equal(verifyUnsubscribeToken(bad), null)
    }
  })

  test('hash is stabiel en ongevoelig voor hoofdletters en spaties', () => {
    assert.equal(hashEmail(' Klant@Voorbeeld.NL '), hashEmail('klant@voorbeeld.nl'))
    assert.notEqual(hashEmail('a@b.nl'), hashEmail('c@d.nl'))
    assert.match(hashEmail('a@b.nl'), /^[a-f0-9]{64}$/)
  })

  test('normalisatie is idempotent', () => {
    const once = normalizeEmail('  A@B.NL ')
    assert.equal(normalizeEmail(once), once)
  })
})
