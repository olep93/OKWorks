# OK Works

Fra utført jobb til dokumentert og fakturert.

OK Works er en mobilvennlig ordre-, dokumentasjons- og fakturaportal for små
servicebedrifter. Førsteutkastet demonstrerer dashboard, aktiv ordre, jobbaktivitet,
registreringshandlinger og en modulær ferdigstillingskontroll.

## Lokal utvikling

```bash
pnpm install
pnpm dev
```

Kvalitetskontroll:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Arkitektur

- Next.js App Router, React og TypeScript strict
- PostgreSQL/Neon og Drizzle ORM
- Penger i heltall øre og kvantum i tusendeler
- Eksplisitt multi-tenant organization context
- Provider-grenser for PDF, storage, e-post, ruter, OCR, abonnement, bank og AI

Se [Fase 0/1-planen](docs/PHASE_0_1_PLAN.md) og
[masterspesifikasjonen](docs/OK_FLOW_MASTER_SPEC_V2.md).
