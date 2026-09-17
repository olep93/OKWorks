# Passordtilbakestilling

Implementert: `/account/forgot`, `/account/reset` og `/api/auth/recovery`.

Aktivering krever `RESEND_API_KEY`, `AUTH_FROM_EMAIL` og `APP_URL` med godkjent HTTPS-adresse. Sett avsender til en adresse på det verifiserte Resend-domenet. Ikke legg nøkler i koden eller NEXT_PUBLIC-variabler.

Token er 32 tilfeldige bytes, hash lagres i databasen, gyldighet 30 minutter. Ny forespørsel erstatter gammel lenke. Engangsbruk skjer med betinget UPDATE i samme transaksjon som sletting av tidligere sesjoner. Lenken bruker URL-fragment for å unngå token i sideforespørselens URL. Aktiveringslenker, samlet misbruksvern for login/registrering og vilkår er fortsatt separate uferdige sjekklistepunkter.

Forespørsler begrenses til fem per adresse per time i delt PostgreSQL-lagring. Dette erstatter ikke edge/IP-beskyttelse eller samlet e-postkvote; begge skal på plass før åpen lansering. Utløpte rate-limit-rader må ryddes av planlagt vedlikehold før stort volum.

## Test før aktivering

1. Manglende konfigurasjon gir tydelig melding, ikke påstand om sendt e-post.
2. Kjente og ukjente adresser får samme generiske svar når sending er aktivert.
3. Be om lenke, åpne, velg nytt passord og logg inn. Gamle sesjoner skal slutte å fungere.
4. Samme lenke skal avvises ved andre gangs bruk; ny forespørsel skal ugyldiggjøre gammel lenke.
5. Kontroller utløp og samtidige forsøk mot separat testdatabase.

Automatiske tester verifiserer konfigurasjon, generiske svar/rate limit og avvisning av utløpt token. Ekte e-post og databasekonkurranse er ikke verifisert før Resend og testkonto er klare.
