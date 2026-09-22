"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type State = { configured: boolean; canManage: boolean; termsVersion: string; subscription: { status: string; cancel_at_period_end: boolean } | null };
export function SubscriptionSandbox() {
  const [state, setState] = useState<State | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    try {
      const response = await fetch("/api/subscription", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke hente status."); }
  }
  useEffect(() => {
    fetch("/api/subscription", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Kunne ikke hente status."));
  }, []);
  async function start(portal = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch(portal ? "/api/subscription/portal" : "/api/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: portal ? undefined : JSON.stringify({ acceptedTestTerms: accepted, termsVersion: state?.termsVersion }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const url = new URL(data.url);
      if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error("Ugyldig betalingsadresse.");
      window.location.assign(url.href);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke åpne testen."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <h1>Abonnement – testmodus</h1>
    <p>Planlagt pris: 99,00 kr per måned inkl. eventuell MVA. Denne testen oppretter ingen bindende avtale, belaster ingen ekte penger og endrer ikke tilgangen din.</p>
    <p>Bruk bare Stripe-testkort. Ikke skriv inn et ekte kortnummer.</p>
    {state && <>
      <p role="status">{!state.configured ? "Stripe-testoppsettet er ikke aktivert ennå." : `Teststatus: ${state.subscription?.status ?? "Ikke opprettet"}`}{state.subscription?.cancel_at_period_end ? " Avsluttes ved periodens slutt." : ""}</p>
      <p>Etter checkout: oppdater status. Retur til denne siden er ikke i seg selv betalingsbekreftelse.</p>
      <label><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Jeg forstår at dette er en uforpliktende test, ikke kjøp av abonnement.</label>
      <button className="primary full" disabled={busy || !accepted || !state.configured || !state.canManage || Boolean(state.subscription && state.subscription.status !== "CANCELED")} onClick={() => start()}>Åpne testbetaling</button>
      {state.subscription && <button className="secondary full" disabled={busy || !state.canManage || !state.configured} onClick={() => start(true)}>Administrer testabonnement</button>}
    </>}
    <button className="secondary full" disabled={busy} onClick={refresh}>Oppdater status</button>
    {error && <p role="alert" className="form-error">{error}</p>}
    <Link href="/">Til portalen</Link>
  </section></main>;
}
