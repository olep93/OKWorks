"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export function EmailVerification() {
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, confirm: boolean) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    try {
      const token = window.location.hash.slice(1);
      if (confirm && !token) throw new Error("Åpne lenken i e-posten først, eller be om en ny lenke nedenfor.");
      const response = await fetch("/api/auth/verification", { method: confirm ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(confirm ? { token } : { email: form.get("email") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (confirm) {
        setComplete(true);
        window.history.replaceState(null, "", window.location.pathname);
        setMessage("E-postadressen er bekreftet. Du kan nå logge inn og fullføre firmaoppsettet.");
      } else setMessage(data.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Noe gikk galt."); }
    finally { setBusy(false); }
  }
  return (
    <main className="auth-page"><section className="auth-card">
      <h1>Bekreft e-postadressen</h1>
      {!complete && <>
        <p>Åpnet du lenken fra e-posten? Trykk nedenfor for å bekrefte. Lenken er gyldig i 24 timer.</p>
        <form onSubmit={(event) => submit(event, true)}><button className="primary full" disabled={busy}>Bekreft e-postadressen</button></form>
        <h2>Trenger du en ny lenke?</h2>
        <form className="auth-form" onSubmit={(event) => submit(event, false)}>
          <label>E-post<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
          <button className="secondary full" disabled={busy}>{busy ? "Et øyeblikk…" : "Send ny bekreftelseslenke"}</button>
        </form>
      </>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <Link href="/">Til innlogging</Link>
    </section></main>
  );
}
