# E-postbekreftelse

Nye kontoer må bekrefte e-post før innlogging. Registrering krever samme serverkonfigurasjon som passordtilbakestilling: `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, `APP_URL`. Uten konfigurasjon returneres 503 før konto opprettes. Betalt abonnement opprettes aldri av registrering eller bekreftelse.

32 tilfeldige bytes sendes i URL-fragment, kun SHA-256-hash lagres. Lenken varer 24 timer og forbrukes atomisk. Sidevisning/GET bekrefter ikke kontoen: brukeren må trykke knappen. Ny utsending erstatter gammel lenke. Ved mailfeil beholdes den ubekreftede kontoen og bruker kan be om ny lenke. Utsending begrenses samlet mellom registrering og ny utsending til fem forespørsler per adresse/time i delt DB-lagring.

Eksisterende kontoer får `verification_required = false` i migreringen for å bevare testtilgang. De skal ikke behandles som nylig e-postverifiserte. Planlegg kontrollert overgang før offentlig lansering. Misbruksvern per IP/global kvote og opprydding i ubekreftede kontoer er fortsatt lanseringspunkter.

## Ende-til-ende før offentlig registrering

1. Opprett separat testkonto; ingen sesjon og ingen portaltilgang før bekreftelse.
2. Kontroller avsender, mottak og at lenken peker til canonical APP_URL.
3. Åpne lenken: ingen aktivering før klikk. Bekreft, logg inn og fullfør firmaoppsett.
4. Avvis gammel lenke etter ny utsending, etter 24 timer og etter første bruk.
5. Test utsendelsesfeil og ny utsending uten duplikatfirma.
6. To firmaer må ikke kunne lese hverandres data. Eksisterende testkonto må fortsatt fungere.

Enhetstester bruker mocks. De erstatter ikke ekte Resend-levering, databasekonkurranse eller tenant-isolasjonstest.
