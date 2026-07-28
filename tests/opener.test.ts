import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { openerIsBetrouwbaar, deterministicOpener } from '../lib/chat/opener'
import { ExtractResult } from '../lib/types'

/** Zes rijen: drie goed, één dubbel, één leeg, één ongeldig formaat. */
const data: ExtractResult = {
  contacts: [
    { name: 'A', email: 'a@x.nl', valid: true },
    { name: 'B', email: 'b@x.nl', valid: true },
    { name: 'C', email: 'c@x.nl', valid: true },
    { name: 'D', email: 'a@x.nl', valid: false, reason: 'duplicate' },
    { name: 'E', email: '', valid: false, reason: 'missing' },
    { name: 'F', email: 'f(at)x.nl', valid: false, reason: 'invalid_format' },
  ],
  summary: { total: 6, valid: 3, invalid: 3 },
}

describe('openingsbericht controleren', () => {
  test('laat de vaste tekst door', () => {
    assert.equal(openerIsBetrouwbaar(deterministicOpener(data), data), true)
  })

  test('laat een vrij geschreven tekst met kloppende aantallen door', () => {
    const tekst = 'Ik heb 3 adressen gevonden die klaarstaan. 3 rijen vielen af: 1 dubbel, 1 zonder adres en 1 met een typefout. Zal ik ze versturen?'
    assert.equal(openerIsBetrouwbaar(tekst, data), true)
  })

  /*
   * Waar het om gaat. Dit bericht staat pal boven de knop die de mails
   * verstuurt, dus een verzonnen aantal is hier duurder dan waar ook.
   */
  test('weigert een verzonnen aantal', () => {
    const tekst = 'Ik heb 4 adressen gevonden. Zal ik ze versturen?'
    assert.equal(openerIsBetrouwbaar(tekst, data), false)
  })

  test('weigert een tekst die het aantal helemaal niet noemt', () => {
    const tekst = 'Je bestand ziet er goed uit. Zal ik ze versturen?'
    assert.equal(openerIsBetrouwbaar(tekst, data), false)
  })

  test('weigert een verkeerd uitgesplitste reden', () => {
    const tekst = 'Ik heb 3 adressen. 3 rijen afgekeurd: 2 dubbel en 1 leeg.'
    assert.equal(openerIsBetrouwbaar(tekst, data), false)
  })

  /*
   * Klantnummers en bedragen mogen het model wel aanhalen. Die zijn groter dan
   * het aantal rijen en kunnen dus niet voor een telling worden aangezien.
   */
  test('staat een klantnummer uit het bestand toe', () => {
    const tekst = 'Ik heb 3 adressen. Bij klantnummer 1045 staat (at) in plaats van @.'
    assert.equal(openerIsBetrouwbaar(tekst, data), true)
  })

  test('bij nul bruikbare adressen hoeft er geen aantal in te staan', () => {
    const leeg: ExtractResult = {
      contacts: [{ name: '', email: '', valid: false, reason: 'missing' }],
      summary: { total: 1, valid: 0, invalid: 1 },
    }
    assert.equal(openerIsBetrouwbaar('Ik vind hier geen bruikbare adressen in.', leeg), true)
  })
})
