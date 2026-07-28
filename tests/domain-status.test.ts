import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { domeinUitleg, magVersturen } from '../lib/domain-status'

describe('mag deze tenant versturen', () => {
  test('alleen bij een geverifieerd domein', () => {
    assert.equal(magVersturen('verified'), true)
    assert.equal(magVersturen('verifying'), false)
    assert.equal(magVersturen('pending'), false)
    assert.equal(magVersturen('failed'), false)
  })
})

describe('uitleg bij een domein dat nog niet klaar is', () => {
  /*
   * Het beheeraccount uit het seed-script heeft met opzet geen bestaand
   * domein. Kreeg het dezelfde melding als een klant, dan ging iemand wachten
   * op een verificatie die nooit komt.
   */
  test('het beheeraccount krijgt te horen dat het nooit gaat versturen', () => {
    const tekst = domeinUitleg('__admin.invalid', 'pending')
    assert.match(tekst, /beheert klanten/)
    assert.doesNotMatch(tekst, /geverifieerd|wacht/i)
  })

  test('tijdens verificatie staat erbij hoe lang het duurt', () => {
    const tekst = domeinUitleg('kvik.send.reviewmoment.nl', 'verifying')
    assert.match(tekst, /kvik\.send\.reviewmoment\.nl/)
    assert.match(tekst, /uur/)
  })

  test('bij een mislukte verificatie staat erbij wat je moet doen', () => {
    const tekst = domeinUitleg('kvik.send.reviewmoment.nl', 'failed')
    assert.match(tekst, /mislukt/)
    assert.match(tekst, /contact op/)
  })

  test('elke melding noemt het domein waar het om gaat', () => {
    for (const status of ['verifying', 'failed', 'pending']) {
      assert.match(domeinUitleg('kvik.send.reviewmoment.nl', status), /kvik\.send\.reviewmoment\.nl/)
    }
  })
})
