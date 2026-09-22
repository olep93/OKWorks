"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export function EmailVerification() {
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [redirectSeconds, setRedirectSeconds] = useState(4);
  useEffect(() => {
    if (!complete) return;
    const redirect = window.setTimeout(() => window.location.replace("/?login=1"), 4000);
    const countdown = window.setInterval(() => setRedirectSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => { window.clearTimeout(redirect); window.clearInterval(countdown); };
  }, [complete]);
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
      <div className="auth-brand"><div className="brand-mark">OK</div><div><h1>OKFaktura</h1><p>Trygg kontoaktivering</p></div></div>
      <div className="auth-copy"><p className="eyebrow">Kontoaktivering</p><h2>{complete ? "E-postadressen er bekreftet" : "Bekreft e-postadressen"}</h2>{complete && <p>Du sendes til innlogging om {redirectSeconds} sekunder.</p>}</div>
      {!complete && <>
        <p>Åpnet du lenken fra e-posten? Trykk nedenfor for å bekrefte. Lenken er gyldig i 24 timer.</p>
        <form onSubmit={(event) => submit(event, true)}><button className="primary full" disabled={busy}>Bekreft e-postadressen</button></form>
        <h2>Trenger du en ny lenke?</h2>
        <form className="auth-form" onSubmit={(event) => submit(event, false)}>
          <label>E-post<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
          <button className="secondary full" disabled={busy}>{busy ? "Et øyeblikk…" : "Send ny bekreftelseslenke"}</button>
        </form>
      </>}
      {message && <p className="auth-success" role="status">{message}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <Link className={complete ? "primary full auth-return" : "auth-back-link"} href={complete ? "/?login=1" : "/"}>{complete ? "Gå til innlogging nå" : "Tilbake til forsiden"}</Link>
    </section></main>
  );
}
