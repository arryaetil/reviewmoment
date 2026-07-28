import { ExtractResult } from '@/lib/types'

/** Hoeveel rijen om welke reden zijn afgekeurd. */
export function redenTelling(data: ExtractResult): Map<string, number> {
  const redenen = new Map<string, number>()
  for (const c of data.contacts.filter((c) => !c.valid)) {
    const label =
      c.reason === 'duplicate' ? 'stond er dubbel in'
      : c.reason === 'missing' ? 'had geen adres'
      : 'had een ongeldig adres'
    redenen.set(label, (redenen.get(label) ?? 0) + 1)
  }
  return redenen
}

/**
 * Het openingsbericht zonder taalmodel.
 *
 * Wordt gebruikt als terugval wanneer het model iets schrijft dat de controle
 * hieronder niet doorstaat. Saai, maar altijd waar.
 */
export function deterministicOpener(data: ExtractResult): string {
  const { valid, invalid } = data.summary
  const regels: string[] = []

  if (valid === 0) {
    regels.push('Ik vind geen bruikbare e-mailadressen in dit bestand.')
  } else {
    regels.push(`Ik heb **${valid}** ${valid === 1 ? 'e-mailadres' : 'e-mailadressen'} uit je bestand gehaald.`)
  }

  if (invalid > 0) {
    const uitleg = [...redenTelling(data)].map(([label, n]) => `${n} ${label}`).join(', ')
    regels.push(`${invalid} ${invalid === 1 ? 'rij is' : 'rijen zijn'} overgeslagen: ${uitleg}.`)
  }

  if (data.assessment?.concern) {
    regels.push(`⚠︎ ${data.assessment.concern}`)
  }

  if (valid > 0) {
    regels.push(
      `Als je bevestigt, krijgen die ${valid} mensen één e-mail namens jouw bedrijf, ` +
      `met een link naar je Google-reviewpagina en onderaan een afmeldlink. ` +
      `Er gaat verder niets uit en niemand krijgt een herinnering.`
    )
    regels.push('Zal ik ze versturen?')
  } else {
    regels.push('Upload een ander bestand om het opnieuw te proberen.')
  }

  return regels.join('\n\n')
}

/**
 * Controleert of de tekst van het model geen verzonnen aantallen bevat.
 *
 * Dit bericht staat pal boven de knop die honderden mails verstuurt, dus een
 * getal dat er net naast zit is hier duurder dan waar ook. De regel: elk getal
 * dat verward kan worden met een telling — alles tot en met het aantal rijen —
 * moet een telling zijn die echt bestaat. Grotere getallen mogen wel, want dat
 * zijn klantnummers of bedragen die het model uit het bestand aanhaalt.
 *
 * En het aantal geldige adressen moet er gewoon in staan. Dat is het enige
 * getal waar de gebruiker zijn beslissing op baseert.
 */
export function openerIsBetrouwbaar(tekst: string, data: ExtractResult): boolean {
  const { total, valid, invalid } = data.summary

  const toegestaan = new Set<number>([total, valid, invalid, ...redenTelling(data).values()])

  const getallen = (tekst.match(/\d+/g) ?? []).map(Number)

  for (const n of getallen) {
    if (n <= total && !toegestaan.has(n)) return false
  }

  if (valid > 0 && !getallen.includes(valid)) return false

  return true
}
