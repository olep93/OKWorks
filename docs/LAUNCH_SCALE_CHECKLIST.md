# Lansering, abonnement og kapasitet

Status 17.09.2026: krav og innledende kodegjennomgang, ikke godkjent for 10 000 brukere eller ekte abonnementsbetaling.

## Ferdigstillingskontroll 23.09.2026

- Backendfeil ved kontroll av fakturautkast gir nå en korrekt feilmelding med mulighet til å prøve igjen, ikke feilaktig «Ikke innlogget». Utløpt sesjon gir fortsatt 401.
- Fire nye rutetester dekker innlogging, utilgjengelig faktura, databasefeil og firmafiltre på alle grunnlagsoppslag. SQL-filtre testes med mock; dette erstatter ikke test mot to firmaer i PostgreSQL.
- Totalt 180 tester, typekontroll, lint og produksjonsbygg passerte. Ingen kundedata endret.

## Tilbakestilling av fakturautkast 23.09.2026

- 15 nye rutetester dekker innlogging, firmafiltre på både faktura og ordre, låserekkefølge, blokkering av nummererte/finaliserte/sendte/betalte fakturaer og låste ordre. Kun et tillatt utkast slettes av den testede ruten; kilderegistreringer oppdateres ikke.
- Totalt 176 tester, typekontroll, lint og produksjonsbygg passerte. Dette er en testutvidelse uten endring i produksjonslogikken eller ekte data.
- Databasen er mocket: faktisk kaskadesletting, rollback og samtidige forespørsler må fortsatt verifiseres i separat PostgreSQL-testmiljø.

## Fakturafinalisering 23.09.2026

- Eksplisitt firmafilter på fakturaoppdatering og firma-/ordrefilter på underliggende timer og ordrelinjer. Kildetype skiller timer fra øvrige ordrelinjer.
- Ti regresjonstester dekker innlogging, utilgjengelig faktura, gjentatt finalisering uten nytt nummer, manglende selgeropplysninger, tom faktura, uavklarte bompenger og avgrensede kildeoppdateringer.
- 161 tester, typekontroll, lint og produksjonsbygg passerte. Ingen ekte faktura ble finalisert eller fakturanummer brukt under testene.
- Testene bruker mock av SQL. Reell PostgreSQL-samtidighet og transaksjonsrollback må fortsatt prøves i separat testdatabase.

## Innloggingsvern 23.09.2026

- Maksimalt 20 gyldig formaterte innloggingsforsøk per normalisert e-postadresse i et fast 15-minuttersvindu. Teller ligger i eksisterende auth_mail_limits med separat login-prefiks og hash av adressen, ikke prosessminne. Også vellykkede forsøk teller; eksisterende sesjoner og passord endres ikke.
- Atomisk UPSERT før brukeroppslag og passordverifisering; sperrede forsøk får 429 og Retry-After. Databasefeil gir 503, ikke en omgåelse av vernet. Ugyldig JSON og overlangt passord avvises tidlig.
- 11 nye tester; totalt 151 tester, typekontroll, lint og produksjonsbygg passerte. Ingen ekte brukerkonto ble brukt til å utløse sperren.
- Begrensning: dette er per-adresse-vern, ikke komplett bot-/DDoS-beskyttelse. Distribuerte forsøk mot mange adresser og opprydding av gamle tellerrader må vurderes sammen med trafikkvern før stor offentlig lansering. SQL-atferd er testet med mock, ikke en belastningstest av PostgreSQL.

## Betalingsstatus i fakturavisning 23.09.2026

- Rettet at tidligere sendte, nå betalte fakturaer fortsatt kunne vise «venter på betaling». Egen statusoverskrift og forklaring for betalt, delbetalt, kreditert og annullert.
- Felles testbar statusfunksjon styrer knappene for sending, påminnelse og manuell betaling. Krediterte fakturaer viser ikke lenger «Registrer betaling». Ukjente statuser får ingen slike handlinger.
- Ni nye regresjonstester med syntetiske statuser; totalt 140 tester, typekontroll, lint og produksjonsbygg passerte. Ingen faktura eller betaling i produksjon endres for å teste visningen.

## Tilgangstester 23.09.2026

- 15 nye regresjonstester for fakturadetaljer, PDF og opplastede vedlegg: innlogging kreves før databaseoppslag, firmafilter på faktura/linjer/vedlegg og både filens og foreldreordrens firma kontrolleres. Inaccessible poster gir 404; innhold genereres ikke ved avvist tilgang.
- Vedlegg tillater ikke HTML, SVG eller JavaScript i forhåndsvisning. PDF og vedlegg testes for private/no-store og nosniff.
- PDF-ruten gir nå 401 ved utløpt innlogging, og fakturadetaljer gir 500 ved backendfeil fremfor feilaktig 401.
- 131 tester, typekontroll, lint og produksjonsbygg passerte 23.09.2026. Testene inspiserer genererte SQL-filtre med mock av databasen; de erstatter ikke ende-til-ende-test med to firmaer mot PostgreSQL.
- Betalingspakken fra commit 3789e0e ble publisert og kontrollert: Vercel bekreftet migrering 0015, og skjema/historikk ble kontrollert i produksjon uten å registrere betaling. Se PAYMENT_STABILIZATION.md.

## Stabilisering 22.09.2026 (kveld)

- Utsendingshistorikk vises også på testutkast, med mottaker, emne, tidspunkt og leverandørstatus. Vellykket sending gir en synlig bekreftelse; «sendt» skilles eksplisitt fra «levert».
- Ny utsending beholder delbetalt/betalt status. En betaling som registreres mens e-postleverandøren arbeider, skal heller ikke få fakturaen eller en lukket ordre gjenåpnet.
- Forfallsvisning bruker hele forfallsdagen i Europe/Oslo. Usendte, annullerte og krediterte fakturaer merkes ikke som forfalt.
- Nettverksfeil ved sending, finalisering og betalingsregistrering frigjør knappene og viser feil. Feil ved innlasting av faktura gir en vei tilbake i stedet for endeløs lasting.
- Nye automatiserte sendetester dekker firmafilter, utløpt sesjon, blokkering av ordinær sending av utkast, test-PDF med dokumentasjon, sperrede statuser, påminnelse før sending, bevaring av betalingsstatus og leverandøravvisning.
- Dette er avgrensede regresjonstester, ikke en komplett sikkerhetsrevisjon eller ende-til-ende-test mellom to ekte firmaer. Ingen ekte e-poster sendes av testene.

Neste publiseringsporter: testerfeedback og separat firma-/tilgangstest; leveringswebhook og feilmåling; verifiser de eksternt håndterte løpene for paginering, privat objektlagring og jobbkø; deretter lasttest og restore-test. Abonnement er fortsatt deaktivert, og 10 000-brukerkapasitet er ikke verifisert.

## Avklaringer før betalingsaktivering

- Juridisk selger, organisasjonsnummer, kontaktadresse og utbetalingskonto må avklares og verifiseres hos betalingsleverandør. Domenet kan eies privat; det fastsetter ikke hvem som selger tjenesten.
- Bekreftet pris: 99 NOK per måned inkl. eventuell MVA. Ikke beregn MVA før korrekt avgiftsstatus er registrert.
- Bekreftet kundetype: både næringsdrivende og forbrukere. Avtale, angrerett og informasjonsplikter må dekke forbrukerabonnement.
- Abonnementet skal være deaktivert frem til eksplisitt lansering. Utvikling og test i sandbox først.

## P0: kontosikkerhet og e-post

Registreringsruten krever nå faktisk e-postbekreftelse for nye kontoer og oppretter ikke innloggingssesjon før bekreftelse. Eksisterende testkontoer er beholdt uten retroaktiv sperring; dette er en overgangsordning, ikke bevis på verifisert e-post. Produksjonsflyten må fortsatt testes før offentlig selvregistrering.

- Bekreftelses- og passordtilbakestillingstokens: kryptografisk tilfeldige, hash i database, utløp og atomisk engangsbruk.
- Glemt passord gir samme svar for eksisterende og ukjente adresser. Begrens forsøk og e-postsending i delt lagring, ikke bare prosessminne.
- Ved passordendring: ugyldiggjør gamle sesjoner, ikke logg passord eller tokens.
- Resend-avsender må verifiseres; sikker canonical app-URL for lenker. Ikke stole på vilkårlig Host-header.
- Ved utsendelsesfeil: tydelig ny utsending, ikke erklære e-post bekreftet.
- Førstegangsoppsett og tenant-isolasjon testes ende til ende med to separate firmaer.

Delstatus: passordtilbakestilling er implementert med 30 minutters engangslenke, hash i database og atomisk tilbakekalling av gamle sesjoner. E-postbekreftelse har 24 timers engangslenke, manuell bekreftelsesknapp og ny utsending. Nye kontoer får `verification_required = true`; login og sesjonsoppslag håndhever dette. Begrenset Resend-nøkkel og produksjonsavsender er satt opp. Glemt-passord-meldingen, toveis postkassetest og en kontrollert fakturautsending med PDF-vedlegg ble levert 22.09.2026. Nyregistrering/aktivering må fortsatt ende-til-ende-testes med en separat testkonto og tenant. Se `password-recovery.md`, `email-verification.md` og `domain-email-production.md`.

## P0: abonnement og avtale

Delstatus: Stripe Checkout, signaturverifisert webhook, hendelseslogg, idempotente testforsøk, server-verifisert testpris og Customer Portal er implementert bak en streng testmodus. Ingen portaltilgang avhenger av abonnementet, og live-nøkler avvises. Se `subscription-sandbox.md`. Stripe-konto, testprodukt, test-webhook og ende-til-ende-test er ikke konfigurert. Dette er ikke godkjenning for ekte betaling.

- Betalingsleverandør med hosted checkout, tilbakevendende NOK-belastning og verifisert utbetalingskonto. Ikke lagre kortinformasjon i OK Works.
- Signerte webhooks, varig hendelseslogg, duplikatvern og håndtering av hendelser ute av rekkefølge. Redirect fra checkout er ikke betalingsbevis.
- Oppsigelse, betalingsfeil, eventuell betalingsfrist og tilgang etter oppsigelse må defineres. Bevar nødvendig eksport/arkivtilgang.
- Logg hvilken vilkårsversjon kunden aksepterte og tidspunktet. Markedsføringssamtykke holdes adskilt og frivillig.
- Vis pris, fornyelse, eventuell binding, oppsigelse og selger før bestilling. For forbrukere må angrerett og digitale tjenesters særregler vurderes.
- Send ordrebekreftelse med avtaleversjon på varig medium og kvittering/faktura etter betaling. Ikke send betalingskvittering før betalingsbekreftelse.
- Personvernerklæring og databehandleravtale med kunder/underleverandører, lagringstid, eksport og sletting. Juridisk gjennomgang før lansering.

## P1: målbar kapasitet

10 000 registrerte brukere er ikke det samme som 10 000 samtidige brukere. Før kapasitetsløfte må vi fastsette aktive firmaer, samtidighet, ordre-/bildemengde og toppbelastning.

Kodefunn:

- `/api/app` laster alle kunder og ordre for firmaet uten paginering. Innfør sidestørrelser, søk og serverfiltrering før store datasett.
- Bilder/filer ligger som `order_entries.file_data` i PostgreSQL. Flytt nye filer til privat objektlagring, med tenant-bundet tilgang, kvoter og kontrollert migrering av eksisterende filer.
- PostgreSQL-klient tillater fem forbindelser per serverinstans. Verifiser pooled Neon-tilkobling og samlet forbindelsesbudsjett under autoskalering.
- Tenant-indekser finnes, men valider med query plans og realistiske datamengder før nye indekser.
- PDF-generering og sending skjer i forespørsler. Innfør jobbkø, begrenset samtidighet, retry/idempotens og varig jobbstatus.

Før godkjent kapasitet:

- Lasttest i separat miljø med syntetiske data: login, registrering, lister, oppdatering, sletting og PDF/e-post. Ikke kjør volumtest mot produksjon uten eksplisitt tillatelse.
- Mål p50/p95/p99, feilrate, CPU/minne, DB-forbindelser og køtid. Foreløpig mål: p95 under 1 sekund for normale liste-/endreoperasjoner og under 2 sekunder for login ved avtalt samtidighet; må verifiseres, ikke lovet.
- Backup og faktisk restore-test; definert RPO/RTO. Fakturaarkiv skal ikke forsvinne ved kontosletting uten vurdert oppbevaringsplikt.
- Feilovervåking, tenant-sikker logging, leverandørkvoter og budsjettvarsler. Regn kostnader for Vercel, Neon, lagring, e-post, Maps/DIB og betaling mot 99-kronersprisen.
- Domene/HTTPS, DNS, SPF/DKIM/DMARC og e-postleverbarhet testes før migrering fra testadressen. Domene, HTTPS, DNS-autentisering, begrenset Resend-nøkkel, faktisk postkasse, toveis postkassetest, passordmail og kontrollert fakturasending med PDF er bekreftet 22.09.2026. Full meldingshodekontroll, leveringsmåling og retur-/bouncehåndtering gjenstår. Se `domain-email-production.md`.

## Kilder som må holdes oppdatert

- https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/digitale-tjenester-og-forbrukeres-personopplysninger/avtaleinngaelse-og-behandling-av-personopplysninger/
- https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/hvordan-lage-en-databehandleravtale/naar-maa-man-inngaa-databehandleravtale/
- https://lovdata.no/dokument/NL/lov/2014-06-20-27
- https://support.stripe.com/questions/what-do-i-need-to-do-to-verify-my-stripe-account
