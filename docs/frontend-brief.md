# Opdracht: frontend herzien naar minimalisme

Lees dit bestand en voer het uit. Werk in fases en laat na elke fase zien wat
je hebt gedaan voordat je verdergaat.

## Context

Dit is Reviewmoment: een tool waarmee MKB-bedrijven automatisch Google
Review-verzoeken sturen naar hun klanten. De backend is af en productieklaar.
Alleen de frontend moet nog worden herzien — die komt uit een POC die
CloudCast heette en die huisstijl zit er nog in.

Lees eerst `CLAUDE.md` voor de architectuur en de positionering.

## Het probleem

Tailwind staat geconfigureerd maar wordt niet gebruikt. Alle opmaak zit als
inline `style`-objecten in de componenten, verspreid over ruim 1100 regels:

- `app/page.tsx`
- `app/login/page.tsx`
- `app/settings/page.tsx`
- `components/AppShell.tsx`
- `components/Chat.tsx`
- `components/FileUpload.tsx`

In `app/globals.css` staan wél tokens (`--blue`, glass-variabelen), maar de
componenten negeren die grotendeels. Gevolg: één kleur wijzigen betekent
handmatig door elk bestand.

De huidige stijl is glassmorphism met mesh-gradiënten, `backdrop-filter` en
fel elektrisch blauw (`#1a44e8`). Dat is CloudCast, niet Reviewmoment.

## Doel

Minimalisme. Concreet betekent dat hier:

- **Weg**: mesh-gradiënten, `backdrop-filter`, glaseffecten, meervoudige
  schaduwen, decoratieve iconen, `border-radius` boven 12px.
- **Terug**: platte vlakken, witruimte als het belangrijkste ordenende
  middel, hooguit één subtiele schaduw, dunne randen in een neutrale grijstint.
- **Kleur**: navy `#1E3243` voor tekst en vlakken, goud `#D2A03B` uitsluitend
  als accent — knoppen, focusstaten, actieve items. Nooit als groot vlak.
  Verder alleen neutrale grijstinten en gebroken wit.
- **Typografie**: maximaal vier groottes en twee gewichten in de hele
  applicatie. Hiërarchie maak je met grootte en witruimte, niet met kleur.
- **Beweging**: alleen functionele overgangen (hover, focus, laadstatus).
  Geen animaties die alleen decoratief zijn.

De toon is rustig en degelijk, niet glanzend. De doelgroep is een
garagehouder of saloneigenaar die sceptisch is over reviewtools — vertrouwen
wek je hier met rust, niet met effecten.

## Volgorde

**Fase 1 — tokens.** Definieer kleur, typografie, ruimte, radius en schaduw op
één plek: CSS-variabelen in `globals.css`, doorgezet naar `tailwind.config.ts`.
Verwijder de ongebruikte glass- en blauwtokens. Na deze fase moet een
merkwijziging één bestand zijn.

**Fase 2 — componenten.** Zet de inline styles om naar Tailwind-klassen die
naar die tokens verwijzen. Trek terugkerende patronen (kaart, knop, invoerveld,
label) in kleine componenten in `components/ui/`. Verander in deze fase geen
gedrag, alleen opmaak.

**Fase 3 — schermen.** Loop login, het upload/chat-scherm en instellingen
langs en herzie de indeling volgens bovenstaande principes. Het chat-scherm is
het hart van het product: de gebruiker uploadt een bestand en bevestigt. Alles
wat die twee handelingen niet dient, mag weg.

**Fase 4 — logo en favicon.** In `public/` staan `logo.svg` (verticaal),
`logo-horizontal.svg` (voor de header), `logo-mark.svg` en `favicon.svg`.
Hang ze in en verwijder `logo.png` en `logo-icon.png`.

## Niet doen

- **De e-mailtemplate in `lib/email/template.ts` niet restylen.** Die mail gaat
  uit namens de klant, niet namens Reviewmoment, en moet neutraal blijven. Er
  staan tests op die falen zodra er incentive-taal of sturende taal in sluipt.
- **Geen API-routes, database of verzendlogica aanraken.** Dit is puur
  frontend.
- **Geen `localStorage` of andere browseropslag toevoegen.**
- **Geen nieuwe afhankelijkheden** zonder te vragen. Tailwind is er al.

## Opruimen

In `public/` staan twee bestanden die daar niet horen en publiek bereikbaar
zijn: `test-klanten.csv` en `Agents | Synthflow.html`. Verwijder ze.

## Klaar wanneer

- `npm run build` is groen
- `npm test` is groen (23 tests)
- `npx tsc --noEmit` geeft geen fouten
- Er staat geen enkel inline `style`-attribuut meer in de componenten
- Zoeken op `#1a44e8`, `backdrop-filter`, `bg-mesh` en `glass` levert niets op
- Een kleur wijzigen kost één aanpassing in één bestand
