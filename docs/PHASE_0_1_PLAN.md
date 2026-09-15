# OK Works – Fase 0/1

## Mål

Første leveranse skal demonstrere den komplette kjernen:

`Kunde → ordre → timer/linjer → ferdigstillingskontroll → faktura → PDF`

Den skal være enkel nok til å iterere raskt, men ha sikre grenser rundt tenant-data,
økonomi og eksterne leverandører.

## Arkitektur

- Next.js App Router og TypeScript strict, deployet på Vercel.
- Modulær monolitt. UI, applikasjonstjenester, domene og infrastruktur skilles uten
  separate mikrotjenester.
- PostgreSQL på Neon med pooled connection string og Drizzle ORM.
- Server-side organization context utledes fra autentisert medlemskap. Ingen
  repository-metode tar en vilkårlig organization-id direkte fra nettleseren.
- Alle tenant-tabeller har `organization_id`, relevante sammensatte indekser og
  tenant-eide fremmednøkler. Automatiske tester forsøker kryss-tenant reads/writes.

## Auth og roller

- MVP: e-post/passord, Argon2id eller scrypt, roterbar server-side session,
  HttpOnly/Secure/SameSite-cookie, rate limiting og audit events.
- `users` inneholder global identitet; `organization_members` inneholder rolle og
  medlemskap. Roller: OWNER, ADMIN, USER.
- Auth-adapteren holdes separat fra domenet. Senere TOTP, recovery codes,
  WebAuthn/passkeys og device sessions kan legges til uten å endre tenant-modellen.
- Kritiske handlinger (bank, roller, sikkerhet) får re-auth policy før produksjon.

## Domenekjerne og transaksjoner

- Penger lagres som heltall i øre (`bigint` i PostgreSQL, `number` innenfor validerte
  safe-integer grenser i TypeScript). MVA og avrunding går gjennom én Money/Tax-tjeneste.
- Produkt-, kunde-, firma-, pris-, MVA- og bankdata snapshots når økonomiske records
  opprettes/finaliseres.
- Fakturafinalisering er én database-transaksjon: lås nummerserie, øk atomisk, opprett
  immutable snapshots/linjer, marker valgte kilder fakturert og skriv audit event.
- Unik constraint på fakturert kilde hindrer dobbel fakturering. Uvalgte poster forblir
  UNBILLED og muliggjør delfakturering.
- Idempotency keys brukes for finalize, sending, webhooks og senere betaling/import.

## Første datamodell

Organization, User, OrganizationMember, AuthSession, Subscription, Customer, Product,
Order, OrderItem, TimeEntry, Attachment, DocumentationItem, Invoice, InvoiceLine,
InvoiceSequence, WebhookEvent og AuditLog.

Utvidelsespunkter reserveres for Trip, Expense, Receipt/OCR, DietRate, Payment,
BankConnection og BankTransaction uten at de må implementeres i første slice.

## Provider-grenser

- `StorageProvider`: private filer, authorisert/signed access og sletting.
- `PdfProvider`: faktura fra immutable snapshot; dokumentasjonsrapport kan senere køes.
- `EmailProvider`: idempotent, retrybar sending med delivery log.
- `RoutesProvider`, `OcrProvider`, `SubscriptionProvider`, `BankProvider`, `AiProvider`.
- Provider-spesifikke ID-er og rådata holdes i integrasjonslaget, ikke i kjernereglene.

## Ferdigstillingskontroll

`FinishJobService` kjører uavhengige regler og returnerer:

```ts
{ severity, code, title, description, relatedEntityType, relatedEntityId, canOverride }
```

BLOCKING må løses eller eksplisitt overstyres etter policy. WARNING krever synlig
bekreftelse; INFO er veiledning. Regler kan legges til uten å endre ordresiden.

## PDF og filer

- Faktura-PDF genereres server-side fra låst snapshot og lagres med checksum.
- `pdf-lib` vurderes først for deterministisk faktura uten browser. En separat renderer
  kan brukes for billedtunge arbeidsrapporter.
- Binærfiler lagres aldri i PostgreSQL. Vercel Blob er første adapter, privat som standard.

## Sikkerhet og drift

- Zod-validering på alle grenser, eksplisitt authorization, CSP/security headers,
  CSRF-vurdering, upload type/størrelse/checksum og ingen sensitive logger.
- Webhook-signatur, provider event-id og idempotent behandling.
- Neon backup/PITR, Vercel observability, error tracking og kostnadsalarmer før produksjon.
- GDPR-retention, eksport, sletting/anonymisering og lovpålagt oppbevaring av faktura
  avklares før ekte kunder.

## Teststrategi

- Unit: money, MVA, markup, snapshots og preflight-regler.
- Repository/integration: tenant-isolasjon, permissions, migrations og indekser.
- Concurrency: fakturanummer og dobbel/delfakturering.
- Contract: providers, webhook-idempotency og OCR-fallback.
- E2E: demo-flyten på mobil og desktop, PDF og immutable finalized invoice.

## Leveranserekkefølge

1. Produktflate med realistisk demo og mobil UX.
2. Domeneverktøy, provider-kontrakter, databasekjerne og migrasjon.
3. Auth/organization context og tenant-sikre repositories.
4. Kunde, produkt, ordre, timer og linjer.
5. FinishJob/Preflight og ordre→faktura-transaksjon.
6. Fakturaarkiv og PDF.
7. Neon/Vercel Blob/Resend-adaptere og staging-deploy.

Bank/KID, ekte abonnement, OCR, AI, kundeportal, signatur, equipment og tilbud er roadmap,
ikke del av første implementasjon.
