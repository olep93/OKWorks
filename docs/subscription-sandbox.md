# Abonnement – Stripe testmodus

Implementasjonen er med vilje ubrukelig med ekte Stripe-nøkler. `BILLING_MODE=test`, en nøkkel som starter med `sk_test_`, en testpris og test-webhook må alle være satt. Portalen låses ikke ved manglende eller avsluttet testabonnement.

Testprisen verifiseres server-side som aktiv, ikke-live, 99,00 NOK, månedlig og `tax_behavior=inclusive`. Klienten kan ikke velge pris eller beløp. Stripe Checkout brukes som hosted betalingsside; kortdata kommer aldri til OKFaktura. Checkout-forsøk og den aksepterte testtekstversjonen lagres før Stripe-kallet og gjenbrukes med idempotensnøkkel ved retry.

Retur-URL gir aldri tilgang eller betalingsstatus. Signerte webhooks leses som uendret råtekst, valideres med test-webhookhemmeligheten og avviser live-hendelser. Abonnementsstatus hentes på nytt fra Stripe under tenant-lås for å tåle duplikater og hendelser ute av rekkefølge. Bare ett produkt, én enhet og riktig testpris godtas. Kundens Stripe-portal kan åpnes av firmaets eier.

## Variabler

- `BILLING_MODE=test`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_TEST_PRICE_ID=price_...`
- `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`
- `APP_URL=https://...` uten query, fragment eller brukerinformasjon

Webhook: `POST /api/subscription/webhook`. Hendelser: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Før aktivering i testmiljø

1. Opprett produkt/pris i Stripe testmodus: 99 NOK/mnd og tax behavior inclusive.
2. Aktiver Stripe Customer Portal i testmodus.
3. Opprett webhook, legg inn signing secret og alle variabler i Vercel Preview først.
4. Kjør checkout med kun Stripe-testkort. Test vellykket, avbrutt, feilet, forfalt betaling, oppsigelse, duplikat webhook og webhook ute av rekkefølge.
5. Kontroller at bare eier kan starte/administere, og at tenant-isolasjon holder med to firmaer.

## Ikke ferdig for ekte betaling

Selgerfirma, organisasjonsnummer, utbetalingskonto/KYC, endelige vilkår, angrerett, kvitteringer, eventuell MVA/Stripe Tax, databehandleravtaler og juridisk gjennomgang gjenstår. Produksjonsnøkler skal ikke settes før separat live-gjennomgang og en eksplisitt aktivering.
