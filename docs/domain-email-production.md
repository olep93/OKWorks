# Domene og produksjons-e-post

Status 22.09.2026:

- `okfaktura.no` er registrert hos Norid og bruker Domeneshops navneservere.
- Domenets A-post peker til Vercels anbefalte produksjonsadresse. Vercel har gyldig HTTPS og domenet er koblet til Production.
- `www.okfaktura.no` videresender permanent (308) til samme sti og query på `https://okfaktura.no`.
- Vercel Production har `APP_URL=https://okfaktura.no`, `AUTH_FROM_EMAIL` og `INVOICE_FROM_EMAIL` med avsender `post@okfaktura.no`.
- Domeneshops e-postpakke er aktiv og `okfaktura.no` er koblet til pakken. MX, SPF og Domeneshops DKIM er publisert. DMARC står foreløpig i overvåkingsmodus (`p=none`).
- Resends DKIM- og sending-CNAME-poster er publisert, og Resend viser domenet som verifisert.

DNS-poster for Vercel og Domeneshop skal ikke fjernes når Resend endres. Resend bruker egne subdomener og kan leve ved siden av Domeneshops MX/SPF/DKIM.

## Gjenstår før komplett produksjonsoppsett

1. Ferdig 22.09.2026: `post@okfaktura.no` er opprettet som faktisk postkasse, og eier har valgt og lagret passordet.
2. Ferdig 22.09.2026: Resend-nøkkel med **Sending access** begrenset til `okfaktura.no` er lagret som hemmelig `RESEND_API_KEY` i Vercel Production.
3. Delvis ferdig 22.09.2026: glemt-passord-meldingen ble levert, manuell melding fra `post@okfaktura.no` fikk svar tilbake i postkassen, og en kontrollert testfaktura med PDF-vedlegg ble levert til `olep93@gmail.com`. Test fortsatt nyregistrering/aktivering med en separat testkonto.
4. Kontroller SPF, begge DKIM-signaturer og DMARC i de mottatte meldingshodene. Stram DMARC gradvis etter stabil test; ikke gå rett til `reject`.
5. Implementer Resend-webhook for levert, bounced og complained, og vis leveringsstatus uten å markere en avvist e-post som levert.
6. Lag en rutine for nøkkelrotasjon og tilbakekalling. Unngå en konto-vid fulltilgangsnøkkel for denne appen.

Lokale DNS-resolvere kan vise gamle data i inntil tidligere TTL. Autoritative navneservere og offentlige resolvere må brukes ved feilsøking under overgangsperioden.
