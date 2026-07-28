# Ontwerpsysteem

Alle waarden staan als CSS-variabele in `app/globals.css` en worden doorgezet
naar `tailwind.config.ts`. Een merkwijziging is één blok in één bestand.

## Thema

Licht. De gebruiker zit overdag in een kantoortje bij tl-licht, vaak met de
laptop naast een openstaande deur. Een donker thema zou hier een keuze zijn om
er technisch uit te zien, niet om beter leesbaar te zijn.

**Kleurstrategie: restrained.** Neutrale grijstinten dragen het vlak, navy
draagt tekst, goud is accent op minder dan tien procent van het oppervlak.

## Kleur

| Rol | Token | Waarde |
|---|---|---|
| Tekst en vlakken | `--color-navy` | `#1E3243` |
| Navy actief | `--color-navy-hover` | `#17262F` |
| Accent | `--color-gold` | `#D2A03B` |
| Accent actief | `--color-gold-hover` | `#B8862B` |
| Achtergrond | `--color-canvas` | `#FAFAF8` |
| Vlak | `--color-surface` | `#FFFFFF` |
| Rand | `--color-border` | `#E3E3DF` |
| Rand nadruk | `--color-border-strong` | `#CDCDC7` |
| Gedempte tekst | `--color-text-muted` | `#6B7580` |
| Subtiele tekst | `--color-text-subtle` | `#909AA3` |
| Fout | `--color-danger` | `#A33A2E` |
| Goed | `--color-success` | `#3B6B52` |

Goud draagt navy-tekst, nooit wit: wit op `#D2A03B` haalt 2.3:1, navy haalt
6.3:1.

## Typografie

Eén familie: DM Sans. Er stond een display-schreef op de paginatitels, maar
die deed op een inlogscherm met één woord meer aan versiering dan aan
hiërarchie — en hiërarchie hoort hier uit grootte en witruimte te komen.

Vier groottes, twee gewichten. Meer niet, in de hele applicatie.

| Token | Grootte | Gebruik |
|---|---|---|
| `--font-size-sm` | 13px | Labels, hulptekst |
| `--font-size-base` | 15px | Lopende tekst |
| `--font-size-lg` | 18px | Sectiekop |
| `--font-size-xl` | 28px | Paginatitel |

Gewichten: 400 en 600. Hiërarchie maak je met grootte en witruimte, niet met
kleur.

## Ruimte

Stap van 4px: `--space-1` tot en met `--space-16`. Witruimte is het ordenende
middel; secties krijgen eerder meer lucht dan een scheidingslijn.

## Vorm

Radius 4 / 8 / 12px. Nooit hoger — de enige uitzondering is de spinner, die per
definitie een cirkel is.

Eén schaduw in de hele applicatie: `--shadow-card`, `0 1px 2px rgba(30,50,67,.06)`.
Meervoudige schaduwen, glaseffecten en `backdrop-filter` zijn verwijderd en
horen niet terug te komen.

## Beweging

`--transition: 150ms ease` voor toestandsovergangen.

Beweging heeft functie of bestaat niet. Wat er is:

- **Laadstatus** — de spinner draait terwijl er echt iets gebeurt.
- **Uittypen van het openingsbericht** — houdt de verzendknop weg tot het
  bericht gelezen kan zijn. Dat is de functie; het effect is bijzaak.
- **Hover en focus** — kleurovergang, geen verplaatsing.

Bij `prefers-reduced-motion: reduce` verschijnt tekst in één keer.

Wat er niet is: entree-animaties, zwevende elementen, pulserende puntjes,
shimmer, elementen die omhoog springen bij hover.

## Componenten

In `components/ui/`:

| Component | |
|---|---|
| `Card` | Plat vlak, dunne rand, één schaduw. `flush` voor inhoud die de rand raakt |
| `Button` | `primary` (goud), `secondary` (rand), `ghost`. Maten sm/md/lg |
| `Input` | Gouden focusring via `--shadow-focus` |
| `Field` + `Label` | Label plus veld met vaste tussenruimte |
| `Notice` | Melding zonder icoon of gekleurd vlak; de kleur van de tekst is het signaal |
| `Spinner` | De enige animatie |

## Layout

Zijbalk van 240px met het horizontale logo, navigatie met een gouden
linkerrand op het actieve item, en onderaan bedrijfsnaam plus uitloggen.

Het hoofdscherm is één kolom. Vóór het uploaden vult het uploadvlak het
midden; daarna krimpt het tot één regel en neemt het gesprek de ruimte over.

De bevestigknoppen staan vast onderaan het chatvenster en scrollen niet mee.
Dat is de kernhandeling van het product; die hoort niet weg te kunnen raken.
