MASTERSPESIFIKASJON – ORDRE-, DOKUMENTASJONS- OG FAKTURAPORTAL Versjon:
2026-09-15

======================================================================
0. PRODUKTVISJON
======================================================================

Bygg en moderne, svært enkel norsk SaaS for små bedrifter, særlig
håndverkere, montører, servicebedrifter og konsulenter.

Dette skal IKKE være et komplett regnskapssystem. Produktets kjerne er:

KUNDE → OPPRETT ORDRE → REGISTRER ARBEID/KOSTNADER FORTLØPENDE →
DOKUMENTER JOBBEN → GENERER FAKTURA → SEND → FØLG BETALING → AUTOMATISK
MATCH MOT BANK/KID SENERE

En ordre skal kunne stå åpen i dager, uker eller måneder. Brukeren skal
kunne åpne samme ordre fra mobilen og fortløpende legge til timer,
produkter, tjenester, kjøring, bom, hotell, diett, utlegg, kvitteringer,
bilder, dokumenter og notater.

Hovedprinsipp: Ikke optimaliser for flest funksjoner. Optimaliser for at
en bruker kan dokumentere en jobb mens den pågår og deretter lage en
profesjonell faktura på svært kort tid.

Systemet skal designes som en ekte multi-tenant SaaS fra første dag og
ikke som en enkeltbedrifts-app som senere må bygges om.

====================================================================== 1.
SKALERING OG ARKITEKTUR
======================================================================

Design for minst: - flere hundre betalende bedrifter uten
arkitekturomskriving - potensielt tusenvis/titusenvis av brukere over
tid - mange samtidige aktive ordre - store mengder bilder, kvitteringer
og PDF-er - horisontal skalering av web/API-laget

Foretrukket første stack: - Next.js - React - TypeScript strict -
PostgreSQL - Neon - Drizzle ORM - Vercel - Vercel Blob i første versjon,
med StorageProvider-abstraksjon - Resend for e-post - Zod - robust
server-side PDF-generator - managed auth eller robust auth-bibliotek når
løsningen går ut av test

Vercel + Neon er en god MVP/vekst-stack, men implementasjonen skal ikke
låse forretningslogikken til én leverandør.

Krav: - lag Database/Storage/Email/Bank/Subscription provider-grenser -
database er source of truth for metadata - binærfiler skal aldri lagres
i PostgreSQL - bruk connection pooling mot Neon - indekser alle sentrale
tenant- og søkefelter - unngå N+1 queries - paginer store arkiver -
background jobs/queue for tunge oppgaver som PDF, OCR, e-post og
bank-sync når volumet gjør dette nødvendig - observability, error
tracking og metrics før produksjonslansering - databasebackup/PITR på
produksjonsnivå - rate limiting og abuse protection -
kostnadsgrenser/alarmer på eksterne API-er

Ikke bygg antakelsen “tusen brukere = tusen database connections”.
Serverless-tilkoblinger skal bruke pooled database endpoint.

======================================================================
2. MULTI-TENANT
======================================================================

Organization er tenant.

Organization ├ Users ├ Customers ├ Orders ├ Products/Services ├ Addons ├
Vehicles ├ Trips ├ Expenses ├ Receipts ├ DietRates ├ Documentation ├
Invoices ├ Payments ├ BankConnections ├ Subscription └ Settings

Alle relevante records skal ha organizationId.

Tenant-isolasjon skal håndheves server-side på ALLE reads/writes. Ikke
stol på organizationId sendt fra browseren.

Alle sentrale queries skal scoperes mot autentisert organization.

Vurder defense-in-depth med PostgreSQL Row Level Security senere, men
applikasjonen må uansett ha eksplisitt authorization.

Test tenant isolation automatisk.

======================================================================
3. AUTENTISERING OG SIKKERHET
======================================================================

TEST/MVP: Det er akseptabelt å starte med enkel e-post/brukernavn +
passord så lenge: - passord hashes med moderne password hashing - ingen
plaintext-passord - sikre sessions/cookies - HTTPS - rate limiting -
brute-force protection - password reset kan legges til - secrets ligger
kun server-side

PRODUKSJON: Før ekte kunder og bankintegrasjon skal auth oppgraderes.

Ønsket sikkerhetsmodell: - e-post + passord som grunnlag - TOTP MFA via
Microsoft Authenticator, Google Authenticator, 1Password osv. -
WebAuthn/passkeys som sterk anbefalt metode - Face ID / Touch ID skal
støttes via passkeys/WebAuthn på kompatible enheter, ikke via egen “Face
ID-database” - recovery codes - session/device management -
re-authentication for kritiske handlinger - MFA obligatorisk for
Owner/Admin når bankintegrasjon aktiveres - audit log for kritiske
sikkerhetshendelser

Roller: OWNER ADMIN USER

Owner: - full kontroll - abonnement - bankkobling - brukere/roller -
firmaoppsett

Admin: - ordre, kunder, produkter, faktura, dokumentasjon - begrensede
kritiske innstillinger etter policy

User: - operative ordre - timer - kjøring - utlegg -
bilder/dokumentasjon - fakturering bare dersom tillatelse

Design permission-systemet slik at granular permissions kan komme
senere.

======================================================================
4. ABONNEMENT / SAAS BILLING
======================================================================

Systemet skal fra starten ha en Subscription-modell selv om betaling
ikke implementeres i første sprint.

Første prismodell kan eksempelvis være: BASIC – 99 NOK/mnd

Pris er foreløpig produktbeslutning og må kunne endres uten kodeendring.

Ved registrering: 1. Opprett bruker 2. Opprett Organization 3. Opprett
Subscription med TRIAL eller INCOMPLETE 4. Onboarding av firma 5. Koble
betalingsavtale når betalingsløsning aktiveres 6. Aktiver abonnement 7.
Automatisk månedlig belastning 8. Webhooks oppdaterer
subscription-status

Subscription: - id - organizationId - provider - providerCustomerId -
providerSubscriptionId - planCode - priceAmount - currency - interval -
status - trialEndsAt - currentPeriodStart - currentPeriodEnd -
cancelAtPeriodEnd - canceledAt - createdAt - updatedAt

Status: TRIAL INCOMPLETE ACTIVE PAST_DUE CANCELED SUSPENDED

Bygg SubscriptionProvider-interface.

Aktuelle leverandører kan være: - Vipps MobilePay Recurring for norsk
abonnement - Stripe Billing dersom ønskelig - annen PSP senere

Ikke hardkod betalingsleverandøren i domenelogikken.

Webhooks må: - signaturverifiseres - være idempotente - lagre provider
event ID - tåle retry/out-of-order events

Grace period ved mislykket abonnementsbetaling. Ikke slett kundens data
umiddelbart ved PAST_DUE/CANCELED.

======================================================================
5. FIRMAONBOARDING OG INNSTILLINGER
======================================================================

Firma laster selv opp: - firmalogo

Firma registrerer: - firmanavn - organisasjonsnummer - MVA-registrert -
adresse - postnummer - sted - telefon - e-post - nettside - bankkonto -
standard betalingsfrist - valuta - standard MVA - standard
fakturatekst - standard e-posttekst

Konfigurerbare satser: - standard timepris - standard km-sats -
hotellpåslag % - generelt utleggspåslag % - materialpåslag % -
dietttyper/satser - egne tjenester/produkter - egne faste tillegg

Logo skal brukes på faktura- og dokumentasjons-PDF.

======================================================================
6. KUNDER
======================================================================

Customer: - id - organizationId - type PRIVATE/COMPANY - name -
companyName - organizationNumber - address - postalCode - city -
invoiceAddress - email - phone - contactPerson - notes -
paymentTermsOverride - createdAt - updatedAt

Fra ordre/faktura skal bruker kunne: - søke eksisterende kunde - velge
kunde - opprette ny kunde inline

======================================================================
7. ORDRE ER HOVEDOBJEKTET
======================================================================

Order er arbeidsflaten.

Ny ordre: - velg/opprett kunde - ordrenavn - beskrivelse -
arbeidsadresse - ansvarlig - startdato

Order: - id - organizationId - orderNumber - customerId - status -
title - description - workAddress - assignedUserId - createdAt -
updatedAt - readyForInvoiceAt - closedAt

Status: DRAFT OPEN IN_PROGRESS READY_FOR_INVOICE INVOICED CLOSED
CANCELLED

Ordren autosaves på en trygg måte.

Mobilvisning skal ha store actions: + TIMER + LINJE + KJØRING + UTLEGG +
HOTELL + DIETT + BILDE + DOKUMENT

Vis kronologisk aktivitet/timeline.

======================================================================
8. PRODUKTER, TJENESTER OG STANDARDLINJER
======================================================================

Firmaet definerer selv standardlinjer.

Eksempel: - Arbeidstime - Smusstillegg - Kabel - Ledning - Lampe 40W -
Servicebil - Oppmøte - Feilsøking - Montasje

Product: - id - organizationId - name - description - unit -
defaultPrice - vatRate - productCode - category - active - sortOrder

På ordre: + LEGG TIL LINJE → searchable dropdown → velg f.eks.
Arbeidstime → antall 2 → pris hentes fra firmaprofil/produkt → 2 × sats

Brukeren kan overstyre linjebeskrivelse, antall, enhet, pris og MVA
dersom permission tillater det.

======================================================================
9. SNAPSHOTS
======================================================================

Kritisk prinsipp: Historiske økonomiske data skal ikke endres fordi
masterdata endres.

Når en linje opprettes lagres snapshot av: - navn/beskrivelse - enhet -
pris - MVA - relevant sats

Hvis Arbeidstime endres fra 790 til 850 senere, beholdes 790 på
eksisterende registrering/faktura.

Snapshot-prinsippet gjelder også: - km-sats - hotellpåslag -
utleggspåslag - diettsats - kundeinfo ved fakturafinalisering -
firmainfo ved fakturafinalisering - bankkonto ved fakturafinalisering

======================================================================
10. TIMER
======================================================================

- TIMER

Felter: - dato - bruker/ansatt - type - antall timer - sats -
beskrivelse

Standard sats hentes fra firmaets oppsett. Satsen snapshots på
registreringen.

======================================================================
11. KJØRETØY OG KJØRING
======================================================================

Vehicle: - id - organizationId - name - registrationNumber -
vehicleType - fuelType - defaultKmRate - tollSettings - active

FuelType: DIESEL PETROL ELECTRIC HYBRID OTHER

- KJØRING

Felter: - kjøretøy - fra - til - dato - en vei / tur-retur - km-sats

Bruk kart/rute-API som Google Routes eller tilsvarende til: -
adresse-autocomplete - avstand - kjøretid - rute - estimert bom der
støttet

Resultat eksempel: Røyken → Oslo 46,3 km én vei 92,6 km tur/retur 6,50
kr/km Kjøring 601,90 kr Estimert bom 86 kr

Brukeren kan overstyre km/sats/bom.

Trip: - id - organizationId - orderId - vehicleId - originText -
destinationText - originCoordinates - destinationCoordinates -
distanceMeters - distanceKm - durationSeconds - roundTrip -
vehicleNameSnapshot - fuelTypeSnapshot - ratePerKm - kmAmount -
estimatedTolls - actualTolls - routeProvider - routeCalculatedAt - date

======================================================================
12. UTLEGG
======================================================================

- UTLEGG

Typer: HOTEL PARKING TAXI FLIGHT FERRY MATERIAL OTHER

Expense: - id - organizationId - orderId - type - vendor - expenseDate -
description - costAmount - vatAmount - markupPercent - markupAmount -
billableAmount - receiptId - billableStatus - invoiceLineId -
createdBy - createdAt

Systemet skal alltid skille: FAKTISK KOSTNAD fra FAKTURERBART BELØP

Eksempel: kostnad 1 000 påslag 10 % påslag 100 fakturerbart 1 100

======================================================================
13. HOTELL
======================================================================

- HOTELL

Brukeren kan: - ta bilde av kvittering - laste opp PDF - fylle manuelt

Felter: - hotellnavn - check-in - check-out - antall netter - kostnad -
MVA-data - påslag % - fakturerbart beløp - kvittering - kommentar

Eksempel: Scandic Kostnad 1 490 Firmaets hotellpåslag 10 % Påslag 149
Fakturerbart 1 639

Påslag kommer fra Organization settings, men kan overstyres med
permission.

======================================================================
14. KVITTERINGSSCANNING / OCR
======================================================================

På mobil: SCAN KVITTERING → åpne kamera → last opp original →
OCR/document extraction

Forsøk å hente: - leverandør - dato - totalsum - MVA - valuta -
organisasjonsnummer hvis tilgjengelig - kvitteringsnummer hvis
tilgjengelig

OCR-resultatet er FORSLAG.

Brukeren skal alltid få: KONTROLLER OPPLYSNINGENE

og kunne endre før bekreftelse.

Receipt: - id - organizationId - attachmentId - extractedVendor -
extractedDate - extractedTotal - extractedVat - extractedCurrency -
extractionConfidence - verifiedByUser - verifiedAt - rawExtractionData

OCR status: UPLOADED PROCESSING EXTRACTED NEEDS_REVIEW CONFIRMED FAILED

OCR-feil må aldri blokkere manuell registrering.

======================================================================
15. DIETT
======================================================================

Ikke hardkod norske satser permanent.

Firmaet kan konfigurere dietttyper/satser, gjerne med
gyldighetsperioder.

DietRate: - id - organizationId - name - amount - validFrom - validTo -
active

DietEntry: - id - organizationId - orderId - userId - date - rateId -
rateNameSnapshot - rateAmountSnapshot - quantity - deductions optional -
billableAmount - notes

- DIETT → velg type → dato → antall → vis sats → lagre snapshot

======================================================================
16. DOKUMENTASJON
======================================================================

Hver ordre har dokumentasjon.

- hovednotat
- bilder
- PDF
- dokumenter
- kvitteringer
- captions
- sortering

Eksempel: Hovednotat: “Feilsøking og utskifting av eksisterende
armatur.”

Bilde 1: “Eksisterende armatur før demontering.”

Bilde 2: “Skadet kabel funnet.”

Bilde 3: “Ny armatur ferdig montert og testet.”

======================================================================
17. BILDEANNOTERING
======================================================================

Rediger bilde: - frihånd - sirkel - rektangel - pil - tekst - undo -
reset - lagre

Behold alltid: - original fil - annotert versjon

Ikke overskriv originalen destruktivt. Optimaliser opplastede bilder og
thumbnails, men behold egnet originalkvalitet.

======================================================================
18. FIL-/BLOB-LAGRING
======================================================================

Attachment metadata i PostgreSQL. Selve filer i object/blob storage.

Attachment: - id - organizationId - storageProvider - storageKey -
originalFileName - mimeType - fileSize - checksum - createdBy -
createdAt

Krav: - private filer som default - signed/authorized access -
MIME-validering - filstørrelsesgrenser - malware scanning vurderes før
produksjon - thumbnails/optimized images - lifecycle/retention policy -
aldri offentlig, gjettbar URL til sensitive kvitteringer/dokumenter

Start gjerne med Vercel Blob, men lag StorageProvider slik at
S3/R2/annen object storage kan byttes inn senere uten domeneomskriving.

======================================================================
19. ORDRE → FAKTURA
======================================================================

Når jobb er ferdig: KLAR TIL FAKTURERING

Vis alle ufakturerte fakturerbare poster: - timer - produkter -
tjenester - tillegg - kjøring - bom - hotell - diett - utlegg

Bruker velger hva som skal faktureres.

OPPRETT FAKTURA

Konvertering skal skje transaction-safe.

Hver ordrepost skal ha fakturastatus: UNBILLED INVOICED NON_BILLABLE

og referanse til invoiceLineId når fakturert.

Dette hindrer dobbeltfakturering.

Arkitekturen skal støtte delfakturering: samme ordre kan gi flere
fakturaer over tid.

======================================================================
20. FAKTURA
======================================================================

Invoice: - id - organizationId - sourceOrderId - invoiceNumber -
customerId - status - issueDate - dueDate - currency - subtotal -
vatAmount - total - paidAmount - remainingAmount - kid -
bankAccountSnapshot - customerSnapshot - organizationSnapshot - notes -
createdAt - finalizedAt - sentAt - paidAt

InvoiceLine: - id - organizationId - invoiceId - sourceOrderItemId
optional - productId optional - lineType - description - quantity -
unit - unitPrice - vatRate - subtotal - vatAmount - total - sortOrder

======================================================================
21. FAKTURANUMMER OG FINALISERING
======================================================================

Fakturanummer genereres automatisk og concurrency-safe.

InvoiceSequence per organization.

Brukeren skal ikke fritt velge/gjenbruke nummer.

Ved FINALIZE: - tildel fakturanummer atomisk - snapshot firma - snapshot
kunde - snapshot bankkonto - snapshot linjer/priser/MVA - beregn
totals - lås kritiske økonomiske data - generer PDF - audit log

Ferdigstilt faktura skal ikke redigeres som utkast. Feil håndteres med
korrekt kreditering/makulering/ny faktura.

======================================================================
22. PDF – MÅ VÆRE RASKT OG ROBUST
======================================================================

PDF-generering er kjernefunksjonalitet.

Mål: - enkel - rask - deterministisk - profesjonell - server-side - ikke
avhengig av at bruker velger “Print to PDF”

Generer: Faktura-1042.pdf Dokumentasjon-1042.pdf

Faktura-PDF: - logo - firmainfo - org.nr - kunde - fakturanummer -
dato - forfall - ordre-ref - linjer - antall - enhet - pris - MVA -
subtotal - total - bankkonto - KID senere

Dokumentasjons-PDF: - logo - ordre/kunde - arbeidssted - hovednotat -
bilder - annoterte bilder - captions - relevante dokumentasjonsdata

Teknisk: Lag PdfService/provider-interface. Velg en løsning som kan
generere faktura raskt uten full browser dersom mulig. PDF må genereres
fra immutable invoice snapshot. Hash/lagre generated PDF slik at samme
finalized invoice ikke tilfeldig endres.

Hvis dokumentasjons-PDF med mange bilder blir tung: - generer asynkront
via job/queue - vis status PROCESSING/READY/FAILED Faktura-PDF bør
normalt kunne genereres umiddelbart.

======================================================================
23. PENGER OG MVA
======================================================================

Ikke bruk ukontrollert JS floating point.

Velg konsekvent: - integer øre, eller - PostgreSQL NUMERIC/DECIMAL med
trygg money utility

Sentraliser: - line totals - MVA - rounding - markup - km - payments

Lag testet Pricing/TaxService.

VIKTIG: Hotell, utlegg, viderefakturering og diett kan ha særskilt
avgiftsmessig behandling. Ikke hardkod juridiske antakelser. Gjør tax
treatment eksplisitt og verifiser norske regler før produksjon.

======================================================================
24. FAKTURAARKIV
======================================================================

Status: DRAFT FINALIZED SENT PARTIALLY_PAID PAID OVERDUE CREDITED VOID

Arkiv: - fakturanummer - kunde - dato - forfall - total - rest - status

Søk/filter: - kunde - fakturanummer - dato - status

Paginer.

======================================================================
25. ORDREARKIV
======================================================================

Vis: - ordrenummer - kunde - arbeidssted - opprettet - sist endret -
ansvarlig - registrert/fakturerbart beløp - fakturert beløp - status

Filter: - mine aktive - alle aktive - klar til fakturering - fakturert -
avsluttet

======================================================================
26. E-POST
======================================================================

Bruk Resend eller provider abstraction.

SEND FAKTURA: - standard e-postmal - Faktura PDF - Dokumentasjons-PDF
valgfritt - andre vedlegg valgfritt

Logg: - recipient - sentAt - providerMessageId - status

E-postsending bør kunne kjøres som retryable job.

======================================================================
27. KID OG BETALINGER
======================================================================

Systemet skal designes for norsk bank/KID fra starten.

Invoice: - kid - kidScheme - bankAccountSnapshot

Payment: - id - organizationId - invoiceId - amount - paymentDate -
kid - reference - bankReference - externalTransactionId - source -
createdAt

Støtt: - manuell betaling - delbetaling - full betaling - overbetaling -
reversering senere

KID skal følge korrekt norsk kontrollsiffer/bankspesifikasjon. Ikke finn
opp en tilfeldig algoritme.

======================================================================
28. NORSK BANKINTEGRASJON – KRITISK
======================================================================

Systemet MÅ kunne kommunisere med norsk bankkonto på en seriøs måte,
f.eks. DNB, men IKKE via scraping av nettbank.

Bankintegrasjonen skal bygges bak et BankProvider-interface.

Mål: - koble bedriftens bank/betalingsstrøm - hente relevante
innbetalinger/transaksjoner - lese KID/referanse når tilgjengelig -
matche mot faktura - opprette Payment - markere invoice
PARTIALLY_PAID/PAID - håndtere avvik manuelt

VIKTIG: Direkte PSD2 Account Information API hos f.eks. DNB er regulert
og direkte produksjonstilgang kan kreve at integratoren er
autorisert/lisensiert TPP med relevante sertifikater.

Derfor skal vi IKKE anta at en liten SaaS bare kan legge inn en DNB API
key.

Arkitekturen skal støtte flere realistiske veier:

1)  Norsk OCR/KID/bankfil-integrasjon
2)  Bank-/ERP-partnerintegrasjon
3)  Lisensiert Open Banking-aggregator som kan koble flere norske banker
4)  Direkte bank-API dersom nødvendige avtaler/lisenser senere er på
    plass

BankProvider eksempel: connect() disconnect() syncAccounts()
syncTransactions() getConnectionStatus() refreshConsent()
handleWebhook()

BankConnection: - id - organizationId - provider -
providerConnectionId - status - consentExpiresAt - lastSyncAt -
createdAt - updatedAt

BankTransaction: - id - organizationId - bankConnectionId -
providerTransactionId - bookingDate - amount - currency - kid -
reference - rawMetadata - matchedInvoiceId - matchStatus - createdAt

MatchStatus: UNMATCHED AUTO_MATCHED MANUAL_MATCHED IGNORED

Matching: 1. exact KID 2. duplicate protection 3. amount 4. invoice
state 5. manual review ved usikkerhet

Bank-data og tokens er svært sensitive: - krypter provider
tokens/secrets - aldri logg tokens - least privilege - audit log -
MFA/re-auth for bankkobling - webhook verification - idempotency

======================================================================
29. ABONNEMENTSBETALING ER SEPARAT FRA KUNDENS FAKTURABETALING
======================================================================

To forskjellige pengestrømmer:

1)  SaaS-abonnement: Bedriften betaler oss f.eks. 99 kr/mnd for å bruke
    systemet.

2)  Fakturabetaling: Bedriftens sluttkunde betaler faktura til
    BEDRIFTENS bankkonto.

Ikke bland disse modellene.

SubscriptionProvider håndterer A. BankProvider/KID/Payment håndterer B.

======================================================================
30. DASHBOARD
======================================================================

Kort: - Fakturert denne måneden - Betalt denne måneden - Utestående -
Forfalt - Aktive ordre - Klar til fakturering

Lister: - mine aktive ordre - siste fakturaer - forfalte fakturaer -
nylige betalinger

Ikke gjør dashboard tungt. Bruk aggregerte/indekserte queries.

======================================================================
31. MENY
======================================================================

Dashboard Ordre Kunder Fakturaer Produkter & tjenester Kjøretøy
Innstillinger

Under innstillinger: - Firma - Logo - Satser - Diett - Brukere -
Sikkerhet - Bank - Abonnement

Senere: Betalinger Rapporter

======================================================================
32. AUDIT LOG
======================================================================

AuditLog: - organizationId - userId - action - entityType - entityId -
metadata - ip/device metadata der lovlig/nyttig - createdAt

Logg: - login/security events - rolleendringer - bank
connect/disconnect - ordre opprettet/endret - expense verifisert -
faktura finalized - faktura sendt - faktura kreditert - betaling
registrert/matchet - firmainnstillinger endret - abonnement endret

======================================================================
33. GDPR / DATA
======================================================================

Før produksjon: - databehandleravtaler med leverandører -
personvernerklæring - dataminimering - retention policy - eksport av
kundens data - sletting/anonymisering der lovlig - juridisk
oppbevaringsplikt må respekteres for faktura/regnskapsmateriale - EU/EØS
datalagring vurderes der relevant - backup/restore-rutine - incident
response

Ikke la “slett konto” automatisk slette materiale som lovlig må
oppbevares.

======================================================================
34. YTELSE / SKALERING TIL TUSENVIS AV BRUKERE
======================================================================

Designkrav: - stateless Next.js app instances - pooled DB connections -
pagination - gode PostgreSQL-indekser - object storage for filer - CDN
for trygge statiske assets - background jobs for tunge oppgaver -
caching bare der data-korrekthet tillater det - database transactions
for økonomiske operasjoner - unique constraints for invoice
sequence/provider IDs - idempotency - optimistic concurrency der
relevant - observability - load test før større lansering

Indekser minst: (organizationId, status) (organizationId, createdAt)
(organizationId, customerId) (organizationId, invoiceNumber)
(organizationId, orderNumber) (organizationId, dueDate)
providerTransactionId unique per provider/connection

Ikke over-engineer microservices i MVP. Start modulært i én
applikasjon/modular monolith. Trekk ut workers/services først når reelt
behov oppstår.

======================================================================
35. FORESLÅTT DATABASEKJERNE
======================================================================

Organization User OrganizationUser AuthSession / auth provider data

Subscription SubscriptionEvent

Customer

Order OrderItem TimeEntry

Product Addon

Vehicle Trip

Expense Receipt DietRate DietEntry

Documentation DocumentationItem Attachment

Invoice InvoiceLine InvoiceSequence

Payment

BankConnection BankTransaction

AuditLog

Senere: CreditNote EmailDelivery Job WebhookEvent Plan UsageMetric

======================================================================
36. SIKKERHET – PRODUKSJONSKRAV
======================================================================

- TypeScript strict
- Zod input validation
- authorization server-side
- tenant isolation
- secure sessions
- MFA/passkeys
- re-auth for kritiske handlinger
- rate limiting
- brute force protection
- CSP/security headers
- CSRF-beskyttelse der relevant
- private file authorization
- upload validation
- secrets manager/env
- token encryption
- no sensitive logs
- webhook signatures
- idempotency
- dependency updates
- vulnerability scanning
- audit logging
- backups
- restore test
- least privilege

======================================================================
37. MOBIL UX
======================================================================

Mobil er first-class.

Aktiv ordre: ORDRE \#1042 Hansen Bygg AS

\[ + TIMER \] \[ + LINJE \] \[ + KJØRING \] \[ + UTLEGG \] \[ + HOTELL
\] \[ + DIETT \] \[ + BILDE \]

Timeline under.

Kamera direkte for: - arbeidsbilder - kvitteringer

Notater autosaves. Vis tydelig: LAGRET ✓

God håndtering av dårlig dekning. Vurder offline queue/sync som senere
fase.

======================================================================
38. IKKE BYGG KOMPLETT REGNSKAP NÅ
======================================================================

Ikke MVP: - hovedbok - lønn - MVA-melding - full reiseregning -
bankbetaling - lager - avansert CRM - innkjøp - komplett
prosjektregnskap - inkasso - EHF - eFaktura

Men arkitekturen skal ikke blokkere senere integrasjon mot
regnskapssystem.

======================================================================
39. IMPLEMENTERINGSFASER
======================================================================

FASE 0 – ARKITEKTUR - repo audit - data model - tenant model - auth
strategy - provider interfaces - money/tax strategy - security
baseline - migrations/tests

FASE 1 – KJERNE - auth MVP - Organization - users/roles - company
settings/logo - Customers - Products - Orders - OrderItems -
TimeEntries - Invoice - InvoiceLines - InvoiceSequence - VAT/totals -
PDF - archives

Resultat: Kunde → Ordre → Timer/Linjer → Faktura → PDF

FASE 2 – ORDREFLYT - autosave - timeline - mobil UX - tillegg - status -
delfakturering - prevent double billing

FASE 3 – KJØRING - Vehicles - Routes API - autocomplete - distance -
roundtrip - toll estimate - snapshots

FASE 4 – UTLEGG/REISE - Expenses - Hotel - Receipts - OCR - markup -
DietRate/DietEntry

FASE 5 – DOKUMENTASJON - images - captions - documents - annotations -
documentation PDF

FASE 6 – UTSENDING - email - templates - attachments - delivery logs

FASE 7 – SAAS BILLING - SubscriptionProvider - trial - f.eks. 99 kr/mnd
plan - Vipps Recurring/Stripe eller valgt provider - webhooks -
entitlement checks

FASE 8 – SIKKERHETSHERDING - TOTP - passkeys/WebAuthn (Face ID/Touch
ID) - recovery - device/session management - critical re-auth

FASE 9 – NORSK BANK/KID - KID - Payment - BankProvider - OCR/KID/Open
Banking provider - bank consent/connect - transaction sync/webhooks -
reconciliation - manual review

FASE 10 – PRODUKSJON/SKALA - monitoring - queue/workers - load tests -
backups/PITR - GDPR - cost monitoring - production security review

======================================================================
40. TESTKRAV
======================================================================

Automatiske tester for: - tenant isolation - role permissions - invoice
number concurrency - order → invoice - no double invoicing - partial
invoicing - product snapshots - hourly-rate snapshots - km-rate
snapshots - diet snapshots - markup - VAT - rounding - PDF generation -
finalized invoice immutability - payment partial/full - duplicate bank
transactions - KID matching - webhook idempotency - subscription
status/entitlements - OCR failure/manual fallback

======================================================================
41. DEMOFLOW
======================================================================

Firma: Verkly Demo AS

Kunde: Hansen Bygg AS

Produkter: Arbeidstime 790/time Kabel 29/m Smusstillegg 350 Lampe 40W
449

Bil: Volkswagen Transporter Diesel 6,50/km

Ordre \#2048:

Mandag: 2 timer 14 m kabel Røyken → Oslo tur/retur bom arbeidsbilde

Tirsdag: Hotellkvittering scannes OCR foreslår 1 490 bruker bekrefter
hotellpåslag 10 % fakturerbart 1 639 diett registreres

Onsdag: 3,5 timer ferdigbilder annoter skade med sirkel/pil hovednotat

Klar til fakturering: systemet viser alle UNBILLED poster.

Bruker velger poster og trykker OPPRETT FAKTURA.

Systemet: 1. reserverer/tildeler fakturanummer atomisk 2. lager
snapshots 3. lager InvoiceLines 4. markerer source items INVOICED 5.
beregner MVA/totals 6. finaliserer 7. genererer Faktura-XXXX.pdf 8.
genererer Dokumentasjon-2048.pdf 9. arkiverer 10. sender senere på
e-post

Senere: KID/banktransaksjon kommer inn. Systemet matcher. Payment
opprettes. Invoice går SENT → PAID.

======================================================================
42. FØRSTE OPPGAVE TIL CODEX
======================================================================

VIKTIG: Ikke bygg hele spesifikasjonen med en gang.

1.  Inspiser hele repoet.
2.  Rapporter hva som allerede finnes.
3.  Foreslå konkret arkitektur for Fase 0/1.
4.  Ikke implementer før planen er presentert.

Planen skal eksplisitt dekke:

- multi-tenant isolation
- auth MVP og migrasjonsvei til TOTP/passkeys
- Organization/User/Role
- Subscription-modell fra starten
- Customer
- Order/OrderItem/TimeEntry
- Product
- Invoice/InvoiceLine
- concurrency-safe InvoiceSequence
- money/VAT
- immutable snapshots
- PDF service og valgt bibliotek
- blob/object storage abstraction
- e-post provider abstraction
- Routes/Trip extension point
- Expense/Receipt/OCR extension point
- DietRate extension point
- SubscriptionProvider extension point
- BankProvider extension point
- norsk bank/KID roadmap
- migrations
- indexes
- transaction boundaries
- idempotency
- security
- tests
- scaling assumptions

Vurder om Vercel + Neon + Vercel Blob fortsatt er riktig etter
inspeksjon. Ikke bytt stack bare for å bytte.

Hvis du anbefaler endring, begrunn: - teknisk behov - kostnad -
skalerbarhet - drift - vendor lock-in - migrasjonskostnad

Første implementasjon skal være enkel, men arkitekturen skal tåle at
produktet går fra testbrukere til flere hundre bedrifter og potensielt
tusenvis av brukere uten full omskriving.

======================================================================
43. ABSOLUTTE REGLER TIL CODEX
======================================================================

- Ikke legg business logic i store React-komponenter.
- Ikke stol på klienten for organizationId/permissions/priser.
- Ikke bruk floating point ukritisk for penger.
- Ikke gjør finalized invoices mutable.
- Ikke lag offentlig blob-tilgang til sensitive dokumenter.
- Ikke scrape nettbank.
- Ikke hardkod én bankleverandør.
- Ikke hardkod én subscription provider.
- Ikke hardkod diettsatser.
- Ikke hardkod juridisk/MVA-behandling uten verifikasjon.
- Ikke generer fakturanummer på en race-condition-utsatt måte.
- Ikke fakturer samme ordrepost to ganger.
- Ikke stol automatisk på OCR.
- Ikke lagre passord i plaintext.
- Ikke lagre banktokens ukryptert.
- Ikke implementer egen Face ID; bruk WebAuthn/passkeys.
- Ikke over-engineer microservices i MVP.
- Behold modulær arkitektur og klare provider-grenser.

======================================================================
44. SLUTTMÅL
======================================================================

En liten bedrift skal kunne:

1.  registrere seg og opprette firma
2.  abonnere på tjenesten
3.  laste opp logo
4.  sette priser/satser
5.  opprette kunder
6.  opprette ordre
7.  registrere timer/materialer fortløpende
8.  beregne kjøring og bom
9.  scanne hotell/utleggskvitteringer
10. bruke firmaets påslag
11. registrere diett
12. ta og annotere arbeidsbilder
13. lage dokumentasjon
14. konvertere ufakturerte ordreposter til faktura
15. generere profesjonell PDF raskt
16. sende faktura
17. se faktura i arkiv
18. koble norsk bank/KID
19. få faktura automatisk markert betalt
20. bruke sterk MFA/passkey-sikkerhet i produksjon

# Dette er produktet som skal bygges.

# 45. OK FLOW – PRODUKTIDENTITET OG DIFFERENSIERING

Arbeidstittel på selskap: OK Solutions

Produktnavn: OK Flow

OK Flow skal IKKE posisjoneres primært som “enda et fakturaprogram”.

Produktets tydelige kjerne skal være:

JOBB → DOKUMENTASJON → FAKTURA → BETALT

Forslag til produktløfte: “Fra utført jobb til dokumentert og
fakturert.”

Regnskapssystemer kan senere være integrasjonspartnere. OK Flow skal
være systemet den operative brukeren faktisk ønsker å bruke mens jobben
utføres.

======================================================================
46. AUTOMATISK ARBEIDSRAPPORT – KJERNEFUNKSJON
======================================================================

Dokumentasjon skal være mer enn løse filvedlegg.

OK Flow skal kunne bygge en strukturert arbeidsrapport automatisk fra
det som allerede er registrert på ordren:

- kunde
- arbeidssted
- dato/periode
- ansvarlig/utførende
- arbeidsbeskrivelse
- timer
- materialer
- kjøring
- relevante utlegg
- bilder
- bildeklassifisering
- captions
- notater
- sjekkliste/godkjenning senere

Eksempel:

ARBEIDSRAPPORT \#2048

Kunde: Hansen Bygg AS

Arbeidssted: …

Utført arbeid: Feilsøking og utskifting av skadet kabel.

Arbeidstid: 5,5 timer

Materiell: 14 m kabel 1 stk armatur

Reise: Røyken → Oslo → Røyken 92,6 km

Dokumentasjon: Før-bilde Avdekket skade Utført utbedring Ferdig resultat

Utført av: …

Rapporten skal kunne genereres som profesjonell Dokumentasjon-PDF uten
at brukeren manuelt må sette sammen et dokument.

======================================================================
47. BILDETYPE: FØR / AVVIK / UNDER ARBEID / ETTER
======================================================================

Ved opplasting eller fotografering skal bruker enkelt kunne klassifisere
bildet:

BEFORE ISSUE DURING AFTER OTHER

Norsk UI: Før Avvik/skade Under arbeid Etter Annet

Dette skal brukes til: - automatisk sortering av arbeidsrapport -
før/etter-visning - ferdigstillingskontroll - AI-rapport senere

Støtt visning av FØR og ETTER side om side i dokumentasjonsrapporten.

Bildeklassifisering skal være rask å bruke på mobil og aldri gjøre
opplasting unødvendig tungvint.

======================================================================
48. “FERDIGSTILL JOBB” – SIGNATURFUNKSJON
======================================================================

Dette skal behandles som en sentral produktfunksjon.

Når bruker trykker:

FERDIGSTILL JOBB

skal OK Flow kjøre en preflight/quality check før fakturering.

Eksempel:

✓ 7,5 timer registrert ✓ 4 materiallinjer ✓ 92,6 km registrert ✓ Bom
registrert ✓ Hotellkvittering kontrollert ✓ Dokumentasjon finnes ⚠
Mangler etter-bilde ⚠ Arbeidsbeskrivelsen er svært kort ⚠ Kvittering på
249 kr er ikke knyttet til fakturerbart utlegg

Kontrollen skal skille mellom:

BLOCKING WARNING INFO

Ikke alle warnings skal blokkere fakturering.

Etter kontroll:

1.  Kontroller ordre
2.  Generer/oppdater arbeidsrapport
3.  Vis ufakturerte poster
4.  Opprett faktura
5.  Generer PDF
6.  Send
7.  Marker relevant ordrestatus

Preflight-reglene skal bygges modulært slik at flere regler kan legges
til senere uten å bygge om Order-siden.

======================================================================
49. SMART KONTROLL: “HAR DU GLEMT Å FAKTURERE NOE?”
======================================================================

OK Flow skal senere kunne hjelpe brukeren å oppdage potensielt manglende
fakturering.

Første versjon kan være deterministisk/rule-based.

Eksempler:

- bom er beregnet, men ikke fakturerbar linje
- kvittering finnes uten Expense
- Expense finnes, men er NON_BILLABLE/ikke valgt
- registrert kjøring uten km-beløp
- aktiv bruker har registrert arbeid/bilder, men mangler timer
- firmaets standard tillegg kan mangle dersom en eksplisitt regel
  tilsier det
- hotell finnes uten kontrollert kvittering
- dokumentasjon finnes, men ingen arbeidsbeskrivelse

Senere kan AI brukes til å foreslå mulige mangler basert på
mønster/historikk.

VIKTIG: AI/rules skal aldri legge økonomiske linjer på faktura uten at
bruker kan se og godkjenne dem.

Målet er å redusere glemt fakturering og øke fakturakvalitet.

======================================================================
50. AI-ASSISTERT ARBEIDSRAPPORT – SENERE FASE
======================================================================

AI skal brukes som assistent, ikke som skjult source of truth.

Eksempel: Montør skriver: “Bytta kabel pga skade, montert ny lampe,
testa ok”

AI kan foreslå: “Eksisterende kabel ble kontrollert og det ble avdekket
fysisk skade. Skadet kabel ble erstattet, ny armatur ble montert og
installasjonen ble deretter funksjonstestet.”

AI kan også foreslå: - rapportoverskrift - strukturert
arbeidsbeskrivelse - captions - mulig bildeklassifisering - kort
kundesammendrag

Brukeren skal alltid kunne: - se forslag - redigere - godkjenne - avvise

Ikke send AI-generert dokumentasjon automatisk uten brukerens kontroll.

Lag fremtidig AiProvider/service boundary slik at modellleverandør kan
byttes.

======================================================================
51. JOBBØKONOMI / MARGIN
======================================================================

Fordi OK Flow lagrer faktisk kostnad separat fra fakturerbart beløp,
skal arkitekturen støtte enkel jobbøkonomi.

Eksempel:

Fakturerbart: 18 420 kr

Registrerte direkte kostnader: 7 880 kr

Påslag: …

Estimert brutto/dekningsbidrag: …

Dette er operativ jobbøkonomi, IKKE full regnskapsføring.

Mulige senere funksjoner: - margin % - sammenligning mot firmaets
normalnivå - advarsel ved uvanlig lav margin - kostnad vs fakturert per
ordre - margin per jobbtype

Ikke presenter tall som regnskapsmessig fasit dersom systemet ikke har
alle kostnader.

======================================================================
52. KUNDEPORTAL – SENERE PRODUKTFASE
======================================================================

Ikke bygg i første MVP, men arkitekturen bør støtte en sikker
kundevisning.

Mål: Kunden mottar en sikker magic link og kan se:

- jobb/ordre
- status
- arbeidsrapport
- før/etter-bilder
- dokumentasjon
- faktura
- betalingsstatus
- laste ned PDF

Senere: - betaling - godkjenning - melding - historikk

Kunden skal normalt ikke måtte opprette konto.

Bruk: - kortlevd/rotérbar sikker token eller tilsvarende -
authorization - expiry/revocation - audit der relevant

Ikke bruk offentlig gjettbar ordre-URL.

======================================================================
53. KUNDESIGNATUR / GODKJENNING – SENERE
======================================================================

Senere kan en ordre kreve kundegodkjenning ved ferdigstillelse.

Eksempel:

“Arbeidet er utført og gjennomgått.”

Kunde signerer på mobil/nettbrett.

Lagre: - signaturdata/fil - signatoryName - signedAt - relevant
order/document version - audit metadata

Signaturen kan inngå i arbeidsrapporten.

Dette skal være valgfritt per firma/jobbtype.

======================================================================
54. SJEKKLISTER / JOBBMALER – SENERE
======================================================================

Firmaet skal senere kunne definere jobbmønstre/sjekklister.

Eksempel: “Montering varmepumpe”

☐ Serienummer registrert ☐ Før-bilde ☐ Etter-bilde ☐ Kondensavløp
kontrollert ☐ Funksjonstest utført ☐ Kunde instruert ☐ Kundesignatur

Preflight ved FERDIGSTILL JOBB kan kontrollere sjekklisten.

Jobbmal kan også inneholde: - standard beskrivelse - forventede
produkter - standard tillegg - dokumentasjonskrav - forventet tidsbruk

Ikke bygg full template engine i MVP.

======================================================================
55. UTSTYR / SERIENUMMER / QR – SENERE
======================================================================

Fremtidig funksjon:

- UTSTYR

Scan: - QR - strekkode - serienummer

Lagre installert/servicebehandlet utstyr mot: - Organization -
Customer - Order - arbeidssted

Equipment: - manufacturer - model - serialNumber - barcode -
installedAt - customerId - orderId - notes

Dette gjør senere servicehistorikk mulig.

Ikke implementer nå, men unngå arkitektur som gjør det vanskelig.

======================================================================
56. KOPIER TIDLIGERE JOBB – SENERE
======================================================================

Bruker skal senere kunne:

KOPIER SOM NY ORDRE

Fra tidligere ordre kan systemet kopiere: - tittel -
arbeidsbeskrivelse - standard materiallinjer - standard tjenester -
sjekkliste/template - relevante innstillinger

Ikke kopier: - gamle timer - gammel kjøring - gamle utlegg - gamle
kvitteringer - gamle bilder - gammel fakturastatus

Dette skal spare tid ved repeterende arbeid.

======================================================================
57. TILBUD – BEVISST SENERE, IKKE MVP
======================================================================

Tilbudsfunksjon er ønsket på roadmap, men skal IKKE implementeres nå.

Fremtidig flyt:

TILBUD → KUNDE GODKJENNER → ORDRE → ARBEIDSRAPPORT → FAKTURA → BETALING

Fremtidig Quote kan inneholde: - customerId - lines - prices - validity
date - notes - status - customer approval - conversionToOrderId

Når tilbud godkjennes skal det senere kunne konverteres til Order uten
at data må registreres på nytt.

Dagens Order/Customer/Product/Invoice-arkitektur skal ikke være avhengig
av at Order alltid opprettes manuelt.

VIKTIG: Ikke la Codex begynne å implementere Quote/Offer i nåværende
MVP.

======================================================================
58. OPPDATERT PRODUKTROADMAP
======================================================================

NOW / CORE: - multi-tenant - auth MVP - Organization - Customer - Order
som hovedobjekt - timer - produkter/tjenester - ordre-timeline -
fakturering - PDF - snapshots - arkiv - dokumentasjon -
bildeklassifisering - FERDIGSTILL JOBB preflight - faktisk kostnad vs
fakturerbart beløp - struktur for manglende-fakturering-kontroller

NEXT: - kjøring/bom - hotell/utlegg - receipt OCR - diett -
bildeannotering - automatisk arbeidsrapport - e-post - subscription -
sterk auth/MFA/passkeys - KID/bank reconciliation

PRODUCT DIFFERENTIATORS: - svært rask mobil ordre - automatisk
arbeidsrapport - før/etter/avvik-bilder - FERDIGSTILL JOBB quality
check - “mulig glemt fakturering” - jobbøkonomi/margin - AI-assistert
rapport - kundeportal - kundesignatur - sjekklister/job templates -
utstyr/serienummer

LATER: - tilbud - tilbudsgodkjenning - tilbud → ordre -
kundeportalbetaling - integrasjoner mot regnskap - EHF/eFaktura ved
behov - avansert rapportering

======================================================================
59. OPPDATERT FØRSTE CODEX-OPPGAVE
======================================================================

Når denne masterfilen gis til Codex:

IKKE START MED Å IMPLEMENTERE HELE PRODUKTET.

Første oppgave:

1.  Les HELE masterspesifikasjonen.
2.  Inspiser HELE eksisterende repo.
3.  Identifiser hva som allerede finnes.
4.  Ikke slett fungerende arbeid.
5.  Lag en konkret Fase 0/1-plan.
6.  Presenter planen før større implementasjon.

Planen må eksplisitt vurdere:

- multi-tenant model
- tenant isolation
- auth MVP
- migrasjonsvei til TOTP/passkeys
- permissions
- Organization
- Subscription-ready architecture
- Customer
- Order
- OrderItem
- TimeEntry
- Product
- Attachment
- Documentation
- image category BEFORE/ISSUE/DURING/AFTER
- FinishJob/Preflight service
- rule engine/validator for ferdigstillingskontroll
- Invoice
- InvoiceLine
- InvoiceSequence
- partial invoicing
- no double invoicing
- immutable snapshots
- money
- VAT
- PDF service
- documentation report architecture
- StorageProvider
- EmailProvider
- SubscriptionProvider
- BankProvider
- future AiProvider
- indexes
- transactions
- idempotency
- audit log
- security
- test strategy
- Vercel/Neon/Blob scaling
- future Quote without implementing it

Foreslå modulgrenser slik at funksjoner som: - AI rapport -
kundeportal - signatur - sjekklister - equipment - tilbud kan legges til
senere uten å omskrive Order/Invoice-kjernen.

Codex skal spesielt vurdere om FERDIGSTILL JOBB bør være en egen domain
service som returnerer strukturerte checks:

{ severity, code, title, description, relatedEntityType,
relatedEntityId, canOverride }

Dette gjør preflight utvidbar og testbar.

Ikke implementer AI, kundeportal, signatur, equipment eller tilbud i
første implementasjon.

======================================================================
60. OPPDATERT DEMOSCENARIO
======================================================================

OK Solutions Produkt: OK Flow

Firma: Verkly Demo AS / demo organization

Kunde: Hansen Bygg AS

Ordre \#2048

Mandag: - 2 timer - 14 m kabel - Røyken → Oslo tur/retur - bom - bilde
klassifisert FØR - bilde klassifisert AVVIK/SKADE

Tirsdag: - hotellkvittering 1 490 - OCR foreslår data - bruker
verifiserer - hotellpåslag 10 % - fakturerbart 1 639 - diett - 3,5 timer

Onsdag: - ferdig arbeid - bilde klassifisert ETTER - annoter skade -
kort notat: “Bytta kabel pga skade, montert ny lampe, testa ok”

Bruker trykker: FERDIGSTILL JOBB

Preflight: ✓ timer ✓ materialer ✓ kjøring ✓ hotell verifisert ✓
før-bilde ✓ etter-bilde ✓ dokumentasjon ⚠ evt. andre mangler

Senere AI-funksjon kan foreslå profesjonell arbeidsbeskrivelse.

Systemet bygger arbeidsrapport automatisk.

Bruker kontrollerer ufakturerte poster.

OPPRETT FAKTURA

Systemet: - tildeler fakturanummer transaction-safe - snapshotter data -
oppretter invoice lines - hindrer dobbeltfakturering - beregner
MVA/totals - finaliserer - genererer Faktura PDF - genererer
Dokumentasjon PDF - arkiverer - sender

Senere: KID/bank → automatisk Payment → PAID.

Dette er kjernen i OK Flow.
