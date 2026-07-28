import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registeredDomain, toZoneName, toContent } from '../lib/provisioning/transip'

const ZONE = 'reviewmoment.nl'
const KLANT = 'kvik.send.reviewmoment.nl'

describe('TransIP-zone bepalen', () => {
  test('neemt de laatste twee labels van het verzenddomein', () => {
    assert.equal(registeredDomain('send.reviewmoment.nl'), 'reviewmoment.nl')
  })

  test('een expliciete waarde gaat voor', () => {
    assert.equal(registeredDomain('send.example.co.uk', 'example.co.uk'), 'example.co.uk')
  })
})

describe('namen omzetten naar zonenotatie', () => {
  /*
   * Resend levert namen al zonder het geregistreerde domein erachter. Dat is
   * niet vanzelfsprekend en het kostte een mislukte provisioning om te
   * ontdekken, dus het staat hier vast.
   */
  test('een naam van Resend is al relatief en blijft ongemoeid', () => {
    assert.equal(toZoneName('resend._domainkey.kvik.send', ZONE, KLANT), 'resend._domainkey.kvik.send')
  })

  test('het DMARC-record dat we zelf toevoegen is volledig en wordt ingekort', () => {
    assert.equal(toZoneName('_dmarc.kvik.send.reviewmoment.nl', ZONE, KLANT), '_dmarc.kvik.send')
  })

  test('het verzenddomein zelf', () => {
    assert.equal(toZoneName('kvik.send.reviewmoment.nl', ZONE, KLANT), 'kvik.send')
  })

  test('een afsluitende punt hoort er niet toe te doen', () => {
    assert.equal(toZoneName('send.kvik.send.reviewmoment.nl.', ZONE, KLANT), 'send.kvik.send')
  })

  /*
   * De vangrail. Elk record moet binnen het subdomein van díé klant vallen —
   * niet alleen binnen de zone. Anders kan een verkeerd samengestelde naam op
   * de root belanden, waar de MX en SPF van de eigen zakelijke mail staan.
   */
  test('weigert de root van de zone', () => {
    assert.throws(() => toZoneName('reviewmoment.nl', ZONE, KLANT), /valt buiten/)
  })

  test('weigert een record van een andere klant', () => {
    assert.throws(() => toZoneName('_dmarc.andere.send', ZONE, KLANT), /valt buiten/)
  })

  test('weigert een naam uit een vreemde zone', () => {
    assert.throws(() => toZoneName('kvik.send.andersdomein.nl', ZONE, KLANT), /valt buiten/)
  })

  test('trapt niet in een subdomein dat er alleen op lijkt', () => {
    assert.throws(() => toZoneName('nep-kvik.send.reviewmoment.nl', ZONE, KLANT), /valt buiten/)
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
