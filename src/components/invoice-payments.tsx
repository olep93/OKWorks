"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatDate, formatMoney, localDate } from "@/lib/format";

type Payment = { id: string; amount_ore: number | string; paid_at: string; source: string; note: string | null };
type Props = {
  invoiceId: string; totalOre: number; paidOre: number; remainingOre: number;
  open: boolean; onClose: () => void; onChanged: () => Promise<void>;
};

export function InvoicePayments({ invoiceId, totalOre, paidOre, remainingOre, open, onClose, onChanged }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [revision, setRevision] = useState(0);
  const [historyReady, setHistoryReady] = useState(false);
  // Keep the same key and payload on retries after a lost response.
  const attempt = useRef<{ requestId: string; amountOre: number; paidAt: string; note: string } | null>(null);
  const inFlight = useRef(false);
  const amountInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/invoices/${invoiceId}/payments`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Kunne ikke hente betalingshistorikk.");
        if (active) { setPayments(data.payments ?? []); setHistoryReady(true); }
      }).catch(() => { if (active) { setHistoryReady(false); setError("Kunne ikke hente betalingshistorikk. Last siden på nytt før du registrerer flere betalinger."); } });
    return () => { active = false; };
  }, [invoiceId, paidOre, revision]);
  useEffect(() => {
    if (open) amountInput.current?.focus();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !historyReady) return;
    if (!attempt.current) {
      const values = new FormData(event.currentTarget);
      const text = String(values.get("amount") ?? "").replace(/\s/g, "");
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(text)) {
        setError("Skriv et beløp med maksimalt to desimaler, for eksempel 1 250,50.");
        return;
      }
      const amountOre = Math.round(Number(text.replace(",", ".")) * 100);
      if (!Number.isSafeInteger(amountOre) || amountOre <= 0 || amountOre > remainingOre) {
        setError("Beløpet må være større enn null og ikke overstige restbeløpet.");
        return;
      }
      attempt.current = { requestId: crypto.randomUUID(), amountOre, paidAt: String(values.get("paidAt")), note: String(values.get("note") ?? "").trim() };
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(attempt.current),
      });
      const result = await response.json();
      if (!response.ok) {
        // A server/network error may occur after commit. Keep the request key.
        if (response.status < 500) { attempt.current = null; setUncertain(false); }
        else setUncertain(true);
        setError(result.error ?? "Kunne ikke bekrefte betalingen. Prøv samme registrering igjen.");
        return;
      }
      attempt.current = null;
      setUncertain(false);
      setNotice("Betalingen er registrert. Dette er en manuell registrering, ikke en bankoverføring.");
      setRevision((value) => value + 1);
      onClose();
      try { await onChanged(); }
      catch { setHistoryReady(false); setError("Betalingen er lagret, men saldoen kunne ikke oppdateres. Last siden på nytt før du registrerer mer."); }
    } catch {
      setUncertain(true);
      setError("Svaret ble avbrutt. Prøv samme registrering igjen; samme betalingsforsøk blir ikke bokført to ganger.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="delivery-history" aria-label="Betalinger">
    <h3>Betalinger</h3>
    <dl className="payment-summary">
      <div><dt>Fakturabeløp</dt><dd>{formatMoney(totalOre)}</dd></div>
      <div><dt>Registrert betalt</dt><dd>{formatMoney(paidOre)}</dd></div>
      <div><dt>Gjenstår</dt><dd>{formatMoney(remainingOre)}</dd></div>
    </dl>
    {notice && <p role="status" className="secure-note">{notice}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {open && <form className="send-form" onSubmit={submit}>
      <p>Registrer kun penger som faktisk er mottatt. Dette flytter ikke penger fra banken.</p>
      <label className="field"><span>Innbetalt beløp (kr)</span><input ref={amountInput} name="amount" inputMode="decimal" defaultValue={(remainingOre / 100).toFixed(2).replace(".", ",")} required readOnly={busy || uncertain} /></label>
      <label className="field"><span>Betalingsdato</span><input name="paidAt" type="date" defaultValue={localDate()} required readOnly={busy || uncertain} /></label>
      <label className="field"><span>Notat (valgfritt)</span><input name="note" maxLength={500} placeholder="For eksempel referanse fra banken" readOnly={busy || uncertain} /></label>
      <button className="primary full" disabled={busy || !historyReady}>{busy ? "Registrerer…" : uncertain ? "Prøv samme registrering igjen" : "Lagre betaling"}</button>
      <button type="button" className="secondary" disabled={busy || uncertain} onClick={onClose}>Avbryt</button>
    </form>}
    <b>Betalingshistorikk</b>
    {payments.length ? payments.map((payment) => <div className="delivery-row" key={payment.id}>
      <span>{payment.source === "BANK" ? "Bank" : "Manuelt"}</span>
      <strong>{formatMoney(Number(payment.amount_ore))}</strong>
      <small>{formatDate(payment.paid_at)}{payment.note ? ` · ${payment.note}` : ""}</small>
    </div>) : <span>{historyReady ? "Ingen betalinger registrert." : "Betalingshistorikken er ikke lastet inn ennå."}</span>}
  </section>;
}
