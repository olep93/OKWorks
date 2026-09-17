# Lansering, abonnement og kapasitet

Status 17.09.2026: krav og innledende kodegjennomgang, ikke godkjent for 10 000 brukere eller ekte abonnementsbetaling.

## Avklaringer før betalingsaktivering

- Juridisk selger, organisasjonsnummer, kontaktadresse og utbetalingskonto må avklares og verifiseres hos betalingsleverandør. Domenet kan eies privat; det fastsetter ikke hvem som selger tjenesten.
- Bekreftet pris: 99 NOK per måned inkl. eventuell MVA. Ikke beregn MVA før korrekt avgiftsstatus er registrert.
- Bekreftet kundetype: både næringsdrivende og forbrukere. Avtale, angrerett og informasjonsplikter må dekke forbrukerabonnement.
- Abonnementet skal være deaktivert frem til eksplisitt lansering. Utvikling og test i sandbox først.

## P0: kontosikkerhet og e-post

Registreringsruten setter i dag `email_verified_at = now()` uten e-postbevis. Dette må erstattes med faktisk bekreftelse før offentlig selvregistrering.

- Bekreftelses- og passordtilbakestillingstokens: kryptografisk tilfeldige, hash i database, utløp og atomisk engangsbruk.
- Glemt passord gir samme svar for eksisterende og ukjente adresser. Begrens forsøk og e-postsending i delt lagring, ikke bare prosessminne.
- Ved passordendring: ugyldiggjør gamle sesjoner, ikke logg passord eller tokens.
- Resend-avsender må verifiseres; sikker canonical app-URL for lenker. Ikke stole på vilkårlig Host-header.
- Ved utsendelsesfeil: tydelig ny utsending, ikke erklære e-post bekreftet.
- Førstegangsoppsett og tenant-isolasjon testes ende til ende med to separate firmaer.

Delstatus: passordtilbakestilling er implementert med 30 minutters engangslenke, hash i database og atomisk tilbakekalling av gamle sesjoner. Kodekontroller og enhetstester er bestått. Resend-nøkkel/avsender, produksjonsmigrering og faktisk e-postflyt må verifiseres før funksjonen regnes som ferdig. Se `password-recovery.md`. E-postbekreftelse ved registrering gjenstår; dette er ikke et fullført kontooppsett.

## P0: abonnement og avtale

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
- Domene/HTTPS, DNS, SPF/DKIM/DMARC og e-postleverbarhet testes før migrering fra testadressen.

## Kilder som må holdes oppdatert

- https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/digitale-tjenester-og-forbrukeres-personopplysninger/avtaleinngaelse-og-behandling-av-personopplysninger/
- https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/hvordan-lage-en-databehandleravtale/naar-maa-man-inngaa-databehandleravtale/
- https://lovdata.no/dokument/NL/lov/2014-06-20-27
- https://support.stripe.com/questions/what-do-i-need-to-do-to-verify-my-stripe-account
