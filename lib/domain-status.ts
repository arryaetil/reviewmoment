/**
 * Uitleg bij een verzenddomein dat nog niet klaar is.
 *
 * Er stond één zin voor alle gevallen: "Je verzenddomein is nog niet
 * geverifieerd." Die noemt het domein niet, zegt niet waarom, en niet wat je
 * eraan kunt doen. Bij een klant wiens DNS nog aan het propageren is levert dat
 * een telefoontje op, terwijl "dit duurt tot een uur" het antwoord was.
 */
export function domeinUitleg(sendingDomain: string, status: string): string {
  // De interne beheertenant uit het seed-script. Die heeft met opzet geen
  // bestaand domein en hoort nooit te versturen.
  if (sendingDomain.endsWith('.invalid')) {
    return 'Dit account beheert klanten en verstuurt zelf geen e-mail. Log in met het account van de klant voor wie je wilt versturen.'
  }

  switch (status) {
    case 'verifying':
      return `Het verzenddomein ${sendingDomain} wordt nog geverifieerd. Dat duurt meestal een paar minuten en soms tot een uur. Probeer het daarna opnieuw — je bestand blijft staan.`
    case 'failed':
      return `De verificatie van ${sendingDomain} is mislukt. Er is iets misgegaan bij het instellen van de DNS-records; neem contact op zodat we het opnieuw kunnen aanzetten.`
    default:
      return `Het verzenddomein ${sendingDomain} is nog niet ingesteld. Zolang dat niet klaar is kan er geen e-mail uit naam van jouw bedrijf verstuurd worden.`
  }
}

/** Kan deze tenant überhaupt versturen? */
export function magVersturen(status: string): boolean {
  return status === 'verified'
}
