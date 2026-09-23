# Betalingsstabilisering – 23.09.2026

## Implementert

- Eget skjema for manuell betaling med beløp, dato og notat. Fakturabeløp, registrert betalt, restbeløp og betalingshistorikk vises samlet.
- Nye klientforsøk sender en UUID. Ved mistet svar beholdes samme nøkkel og payload ved retry; et allerede lagret forsøk returneres uten ny bokføring. Eksisterende klienter uten nøkkel støttes fortsatt, men får ikke dette retry-vernet.
- Migrering 0015 legger til en nullable UUID-kolonne og unik indeks per firma. Ingen historiske betalinger endres eller slettes.
- Betaling og saldo oppdateres under fakturalås i én transaksjon. Betalte, krediterte, annullerte og utkast-fakturaer avvises. Manuell overbetaling avvises med forklaring.
- Betalingsdatoen valideres som en ekte kalenderdato og brukes som betalingsdato også når fakturaen blir fullt betalt. Manuelle registreringer får revisjonsspor.
- Banksynk importerer og matcher i samme transaksjon, låser fakturaen og leser faktisk betalingssum i stedet for en tidligere hentet saldo. NOK-fakturaer matches ikke mot annen valuta. Overbetalinger blir stående uten automatisk matching.
- Full betaling lukker tilhørende ordre. Alle berørte oppslag/oppdateringer avgrenses til innlogget firma.

## Verifisering og grenser

116 automatiserte tester passerte før publisering, inkludert nye rute-tester for betaling og banksynk. Typekontroll, lint og produksjonsbygg passerte. Rute-testene bruker mock av database og bankleverandør; dette er ikke en reell banksertifisering eller en full samtidighetstest mot PostgreSQL.

Ingen ekte betalinger registreres og ingen banksynk kjøres som del av produksjonskontrollen. Migrering verifiseres via utrullingen. UI kontrolleres ved å åpne eksisterende faktura og skjema uten å sende inn.

## Neste tester i isolert testmiljø

1. Delbetaling, restbetaling og avvisning av overbetaling med syntetiske fakturaer.
2. Samme UUID sendt samtidig fra to forbindelser: nøyaktig én betalingsrad.
3. Samtidig bank- og manuell betaling: korrekt saldo uten tapt oppdatering.
4. To firmaer: ingen tilgang til hverandres fakturaer, vedlegg eller betalingshistorikk.
5. Banktransaksjoner som allerede er registrert manuelt trenger en egen avstemmingsflyt før banksynk brukes med ekte kontoer. Delvise duplikater kan ikke sikkert identifiseres bare fra beløp og KID.

Abonnement og produksjonsbank er fortsatt ikke aktivert av denne endringen.
