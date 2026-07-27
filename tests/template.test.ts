import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { renderReviewRequest } from '../lib/email/template'
import { subdomainFor } from '../lib/provisioning/domain'

const base = {
  name: 'Petra',
  businessName: 'Kvik Maastricht',
  reviewLink: 'https://g.page/r/abc123',
  unsubscribeUrl: 'https://app.reviewmoment.app/u/token123',
}

describe('e-mailtemplate', () => {
  test('bevat geen incentive-taal', () => {
    const { html, text, subject } = renderReviewRequest(base)
    const alles = `${html} ${text} ${subject}`.toLowerCase()

    // Deze woorden zijn in strijd met het beleid van Google voor
    // bedrijfsprofielen. Ze mogen niet stilletjes terugsluipen in de template.
    const verboden = [
      'korting',
      'kortingscode',
      'cadeau',
      'winnen',
      'maak kans',
      'als dank ontvangt',
      'gratis',
      'beloning',
      'spaarpunt',
    ]

    for (const woord of verboden) {
      assert.ok(!alles.includes(woord), `template bevat incentive-taal: "${woord}"`)
    }
  })

  test('vraagt niet om een positieve review', () => {
    const { html, text } = renderReviewRequest(base)
    const alles = `${html} ${text}`.toLowerCase()

    for (const woord of ['positieve review', 'vijf sterren', '5 sterren', 'goede review']) {
      assert.ok(!alles.includes(woord), `template stuurt op de uitkomst: "${woord}"`)
    }

    // En noemt expliciet dat ook een negatieve mening welkom is.
    assert.ok(alles.includes('eerlijke'))
  })

  test('bevat altijd een afmeldlink', () => {
    const { html, text } = renderReviewRequest(base)

    assert.ok(html.includes(base.unsubscribeUrl))
    assert.ok(text.includes(base.unsubscribeUrl))
  })

  test('ontsnapt html in door de klant aangeleverde waarden', () => {
    const { html } = renderReviewRequest({
      ...base,
      name: '<script>alert(1)</script>',
      businessName: 'Bedrijf & Zn "test"',
    })

    // Namen komen uit een geüpload bestand van de klant. Zonder ontsnapping
    // kan een geprepareerd bestand markup in de mail injecteren.
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(html.includes('&amp;'))
  })

  test('werkt zonder naam', () => {
    const { html, text } = renderReviewRequest({ ...base, name: null })

    assert.ok(html.includes('Hallo,'))
    assert.ok(text.startsWith('Hallo,'))
    assert.ok(!html.includes('null'))
  })
})

describe('subdomeinen', () => {
  test('maakt een veilige slug van een bedrijfsnaam', () => {
    assert.equal(subdomainFor('Kvik Maastricht'), 'kvik-maastricht')
    assert.equal(subdomainFor("Jan's Garage & Zn."), 'jan-s-garage-zn')
    assert.equal(subdomainFor('  dubbele   spaties  '), 'dubbele-spaties')
  })

  test('haalt accenten weg in plaats van ze te schrappen', () => {
    assert.equal(subdomainFor('Café Zuid'), 'cafe-zuid')
    assert.equal(subdomainFor('Bloemen André'), 'bloemen-andre')
  })

  test('eindigt nooit op een streepje na afkappen', () => {
    // Een dns-label mag niet op een streepje eindigen; door de slice op 40
    // tekens kan dat anders per ongeluk gebeuren.
    const slug = subdomainFor('a'.repeat(39) + ' bedrijfsnaam')
    assert.ok(!slug.endsWith('-'), `slug eindigt op een streepje: ${slug}`)
  })

  test('produceert nooit een lege of ongeldige slug', () => {
    for (const naam of ['', '   ', '!!!', '---']) {
      const slug = subdomainFor(naam)
      assert.ok(slug.length > 0)
      assert.match(slug, /^[a-z0-9][a-z0-9-]*$/)
    }
  })

  test('blijft binnen de lengtelimiet van een dns-label', () => {
    const slug = subdomainFor('a'.repeat(200))
    assert.ok(slug.length <= 63)
  })
})
