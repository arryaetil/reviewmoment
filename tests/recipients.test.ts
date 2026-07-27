import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prepareRecipients, MAX_NAME_LENGTH } from '../lib/recipients'

describe('prepareRecipients', () => {
  test('ontdubbelt op genormaliseerd adres', () => {
    const { recipients, skippedDuplicate } = prepareRecipients([
      { name: 'Petra', email: 'petra@example.nl', valid: true },
      { name: 'Petra van der Berg', email: 'PETRA@example.nl', valid: true },
      { name: 'Petra', email: '  petra@example.nl  ', valid: true },
    ])

    // Hoofdletters en spaties mogen niet tot drie mails aan dezelfde persoon
    // leiden — dit is de duurste fout die deze functie kan maken.
    assert.equal(recipients.length, 1)
    assert.equal(skippedDuplicate, 2)
    assert.equal(recipients[0].email, 'petra@example.nl')
  })

  test('houdt de eerste naam aan bij een duplicaat', () => {
    const { recipients } = prepareRecipients([
      { name: 'Jan', email: 'jan@example.nl', valid: true },
      { name: 'Jan de Vries', email: 'jan@example.nl', valid: true },
    ])

    assert.equal(recipients[0].name, 'Jan')
  })

  test('weigert ongeldige adressen', () => {
    const cases = [
      'geen-apenstaartje.nl',
      'twee@@example.nl',
      'spatie in@example.nl',
      'geen-tld@example',
      'punt.na@example.',
      '@example.nl',
      'komma@example,nl',
      'haakje<@example.nl',
      '',
    ]

    for (const email of cases) {
      const { recipients } = prepareRecipients([{ name: 'x', email, valid: true }])
      assert.equal(recipients.length, 0, `had ${JSON.stringify(email)} moeten weigeren`)
    }
  })

  test('accepteert gangbare geldige adressen', () => {
    const cases = [
      'jan.de.vries@gmail.com',
      'info+reviews@bedrijf.nl',
      'a_b-c@sub.domein.co.uk',
      'Klant@Voorbeeld.NL',
    ]

    for (const email of cases) {
      const { recipients } = prepareRecipients([{ name: 'x', email, valid: true }])
      assert.equal(recipients.length, 1, `had ${email} moeten accepteren`)
    }
  })

  test('vertrouwt het valid-vlaggetje van het model niet blind', () => {
    // Het model kan een onzinnig adres als valid markeren; wij controleren zelf.
    const { recipients, skippedInvalid } = prepareRecipients([
      { name: 'x', email: 'kapot@@adres', valid: true },
    ])

    assert.equal(recipients.length, 0)
    assert.equal(skippedInvalid, 1)
  })

  test('slaat contacten over die het model als ongeldig markeerde', () => {
    const { recipients, skippedInvalid } = prepareRecipients([
      { name: 'x', email: 'goed@example.nl', valid: false },
    ])

    assert.equal(recipients.length, 0)
    assert.equal(skippedInvalid, 1)
  })

  test('kapt te lange namen af en maakt lege namen null', () => {
    const { recipients } = prepareRecipients([
      { name: 'a'.repeat(500), email: 'lang@example.nl', valid: true },
      { name: '   ', email: 'leeg@example.nl', valid: true },
    ])

    assert.equal(recipients[0].name?.length, MAX_NAME_LENGTH)
    assert.equal(recipients[1].name, null)
  })

  test('gaat om met rommel in plaats van te crashen', () => {
    const rommel = [null, undefined, 'string', 42, {}, { email: 123 }]
    const { recipients } = prepareRecipients(rommel)

    assert.equal(recipients.length, 0)
    assert.deepEqual(prepareRecipients('geen array').recipients, [])
    assert.deepEqual(prepareRecipients(null).recipients, [])
  })
})
