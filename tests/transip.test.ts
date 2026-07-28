import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registeredDomain, toRelativeName, toContent } from '../lib/provisioning/transip'

describe('TransIP-zone bepalen', () => {
  test('neemt de laatste twee labels van het verzenddomein', () => {
    assert.equal(registeredDomain('send.reviewmoment.nl'), 'reviewmoment.nl')
  })

  test('een expliciete waarde gaat voor', () => {
    assert.equal(registeredDomain('send.example.co.uk', 'example.co.uk'), 'example.co.uk')
  })
})

describe('namen relatief maken', () => {
  test('haalt de zone van het einde af', () => {
    assert.equal(
      toRelativeName('resend._domainkey.kvik.send.reviewmoment.nl', 'reviewmoment.nl'),
      'resend._domainkey.kvik.send'
    )
  })

  test('MX-hostnaam onder het verzendsubdomein', () => {
    assert.equal(
      toRelativeName('send.kvik.send.reviewmoment.nl', 'reviewmoment.nl'),
      'send.kvik.send'
    )
  })

  test('een afsluitende punt hoort er niet toe te doen', () => {
    assert.equal(toRelativeName('a.b.reviewmoment.nl.', 'reviewmoment.nl'), 'a.b')
  })

  test('de zone zelf wordt @', () => {
    assert.equal(toRelativeName('reviewmoment.nl', 'reviewmoment.nl'), '@')
  })

  /*
   * Dit is de test waar het om gaat. Zonder deze controle zou een record uit
   * een vreemde zone stilzwijgend als losse naam worden weggeschreven, en dan
   * belandt hij naast de MX en SPF van de eigen zakelijke mail.
   */
  test('weigert een naam die buiten de zone valt', () => {
    assert.throws(
      () => toRelativeName('kvik.send.andersdomein.nl', 'reviewmoment.nl'),
      /valt niet binnen de zone/
    )
  })

  test('trapt niet in een domein dat er alleen op lijkt', () => {
    assert.throws(
      () => toRelativeName('kwaadaardig-reviewmoment.nl', 'reviewmoment.nl'),
      /valt niet binnen de zone/
    )
  })
})

describe('inhoud van een record', () => {
  test('MX krijgt de prioriteit vooraan', () => {
    assert.equal(
      toContent({ type: 'MX', name: 'x', value: 'feedback-smtp.eu-west-1.amazonses.com', priority: 10 }),
      '10 feedback-smtp.eu-west-1.amazonses.com'
    )
  })

  test('TXT blijft ongemoeid', () => {
    assert.equal(
      toContent({ type: 'TXT', name: 'x', value: 'v=spf1 include:amazonses.com ~all' }),
      'v=spf1 include:amazonses.com ~all'
    )
  })
})
