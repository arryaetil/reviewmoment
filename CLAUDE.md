# Reviewmoment

Automatische Google Review-verzoeken voor het MKB — binnen het beleid van Google.

## Positionering

De naam is geen toeval. Wat we automatiseren is het **moment** van vragen, niet
de **selectie** van wie we vragen. Dat onderscheid is het hele product:

- Wel: iedere klant krijgt hetzelfde verzoek, kort na de transactie.
- Niet: een tussenstap die op tevredenheid filtert (review gating). Dat is in
  strijd met het beleid van Google en kan leiden tot verwijdering van álle
  reviews van een bedrijfsprofiel, niet alleen de gefilterde.

Ook uit de templates geweerd, omdat het beleidsschendingen zijn die een klant
anders zelf toevoegt: incentives ("korting bij een review"), en het verzoek om
een specifieke medewerker bij naam te noemen.

## Architectuur

```
Browser                    Railway (europe-west4)        Extern
───────                    ──────────────────────        ──────
upload CSV/XLSX  ─────────► /api/extract  ──────────────► Anthropic (Claude)
                                │
bevestigen       ─────────► /api/send                     Postgres (privé netwerk)
                                │  job + ontvangers  ───►
                                │  in wachtrij       ───► Upstash QStash
                                ▼
                           /api/jobs/process  ──────────► Resend (batch van 100)
                                │  plant zichzelf opnieuw in tot klaar
                                ▼
poll status      ─────────► /api/jobs/[id]

afmelden         ─────────► /u/[token]                    (HMAC, geen opslag)
bounces          ─────────► /api/webhooks/resend  ◄────── Resend
```

### Waarom een wachtrij

De POC verstuurde synchroon in een for-loop binnen het request. Bij een paar
honderd adressen loopt dat over de tijdslimiet van een serverless functie:
de helft krijgt mail, de gebruiker ziet een timeout, en opnieuw proberen
levert dubbele mail op. Nu wordt de opdracht vastgelegd in de database en per
batch van 100 verwerkt, met per ontvanger een status. QStash levert minstens
één keer af, dus de worker slaat adressen die al op `sent` staan over.

### Waarom een subdomein per klant

Verzendreputatie wordt per domein opgebouwd. Op één gedeeld domein trekt één
klant met een verouderde lijst — veel bounces, misschien een spamklacht — alle
andere klanten mee de spamfolder in. Elke tenant krijgt daarom
`<klant>.<SENDING_ROOT_DOMAIN>`, automatisch aangemaakt bij onboarding via de
Resend- en Cloudflare-API's. De klant hoeft zelf geen DNS te regelen.

Het verzenddomein staat bewust los van het merkdomein (reviewmoment.nl), zodat
reputatieschade nooit de eigen zakelijke mail raakt.

## Datamodel

| Tabel | Rol |
|---|---|
| `tenants` | Eén per MKB-klant: bedrijfsnaam, reviewlink, verzenddomein, limiet |
| `users` | Inloggen, gekoppeld aan één tenant; rol `owner`/`member`/`admin` |
| `send_jobs` | Eén verzendopdracht, met snapshot van afzender en reviewlink |
| `send_job_recipients` | Per ontvanger een status; wordt geanonimiseerd na afronding |
| `suppressions` | Afmeldingen en bounces, per tenant, adres alleen als SHA-256 |

## Persoonsgegevens

De klant is verwerkingsverantwoordelijke, wij zijn verwerker.

- Adressen van eindklanten staan alleen in `send_job_recipients`, en alleen
  zolang de opdracht loopt. Na afronding wordt het adres vervangen door een
  placeholder; alleen de tellingen blijven staan.
- Mislukte adressen blijven wel leesbaar, zodat de klant ze kan corrigeren.
- Suppressies worden gehasht opgeslagen: we hoeven het adres nooit terug te
  lezen, alleen te toetsen of het voorkomt.
- Logs bevatten uitsluitend aantallen en id's, nooit adressen of namen.
- Afmeldlinks zijn HMAC-ondertekend in plaats van opgeslagen.

## Beveiliging

- JWT bevat alleen `userId` en `tenantId`. Tenantconfig (afzender, reviewlink)
  wordt per request uit de database gelezen. In de POC stond die config in het
  token en werd hij via `x-user-*` headers doorgegeven — dan bepaalt iets
  buiten de route wie de afzender is.
- Elke query op tenantdata filtert expliciet op `tenantId`.
- `/api/jobs/process` en `/api/webhooks/resend` staan buiten de sessie-auth en
  verifiëren hun eigen handtekening (QStash respectievelijk Svix).
- Rate limiting via Railway Redis, gedeeld over alle instanties. De in-memory
  variant uit de POC telde per serverless instantie en was daardoor
  betekenisloos.
- Inlogfouten geven één generieke melding, en bij een onbekend adres wordt
  tegen een dummy-hash vergeleken zodat de responstijd niets verraadt.

## Hosting

Draait op Railway: een langlevend Node-proces, geen serverless functies.
Dat heeft twee gevolgen in de code:

- De databasepool staat op 10 verbindingen. Op serverless zou dat 1 moeten
  zijn (veel korte instanties), op een persistent proces is 1 juist een
  flessenhals. `lib/db/index.ts` detecteert dit en `DB_POOL_MAX` overschrijft.
- `/api/health` doet een echte databasequery. Railway moet een instantie
  waarvan de verbinding weg is niet als gezond blijven zien.

Bewust géén `output: 'standalone'`: dat vraagt een aangepast startcommando en
het handmatig meekopiëren van static assets. De winst is een kleinere image,
de kosten zijn een klasse deployfouten die je pas in productie ziet.

## Setup

```bash
npm install
cp .env.example .env.local     # vul de waarden in
npm run db:generate            # alleen na schemawijzigingen
npm run db:migrate
npm run preflight              # controleert alle externe diensten
npm run seed:admin jij@reviewmoment.nl <wachtwoord>
npm run dev
```

Tests draaien met `npm test`. Ze dekken de logica waar een stille fout het
duurst is: ontdubbeling van ontvangers, ondertekening van afmeldlinks, en de
e-mailtemplate (die mag geen incentive-taal bevatten en moet altijd een
afmeldlink hebben). Alles zonder database of netwerk, dus ze draaien overal.

Daarna klanten aanmaken via `POST /api/admin/tenants` — zonder redeploy.

### Externe configuratie

1. **Postgres** — draait als service in hetzelfde Railway-project en is alleen
   bereikbaar op `*.railway.internal`; geen publieke TCP-proxy. `DATABASE_URL`
   wijst er als referentievariabele naar, zodat het wachtwoord nergens
   gekopieerd staat. Er is geen aparte pooler, dus `DIRECT_DATABASE_URL` is
   dezelfde verbinding.
2. **Cloudflare** — zone voor `SENDING_ROOT_DOMAIN`, API-token met alleen
   `Zone:DNS:Edit` op die ene zone.
3. **Railway Redis + Upstash** — Redis draait privé in Railway; QStash levert de wachtrij en signing keys.
4. **Resend** — API-key en een webhook naar `/api/webhooks/resend` voor
   `email.bounced` en `email.complained`.

## Nog te doen

- Cron die `refreshDomainStatus` periodiek draait voor tenants die op
  `verifying` blijven staan.
- DMARC van `p=none` naar `p=quarantine` zodra de rapportages schoon zijn.
- Retentie-job die oude `send_jobs` opruimt.
- Admin-UI; nu alleen de API-endpoints.
