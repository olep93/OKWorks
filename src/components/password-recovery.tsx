"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(4);
  useEffect(() => {
    if (!complete) return;
    const redirect = window.setTimeout(() => window.location.replace("/?login=1"), 4000);
    const countdown = window.setInterval(() => setRedirectSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => { window.clearTimeout(redirect); window.clearInterval(countdown); };
  }, [complete]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (reset && form.get("password") !== form.get("confirm")) throw new Error("Passordene må være like.");
      const response = await fetch("/api/auth/recovery", { method: reset ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(reset ? { token: window.location.hash.slice(1), password: form.get("password") } : { email: form.get("email") }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(reset ? "Passordet er endret. Logg inn med det nye passordet." : data.message);
      if (reset) { window.history.replaceState(null, "", window.location.pathname); setComplete(true); }
    } catch (error) { setError(error instanceof Error ? error.message : "Noe gikk galt."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">OK</div><div><h1>OKFaktura</h1><p>Trygg kontotilgang</p></div></div><div className="auth-copy"><p className="eyebrow">{reset ? "Nytt passord" : "Kontohjelp"}</p><h2>{complete ? "Passordet er endret" : reset ? "Velg nytt passord" : "Glemt passord"}</h2><p>{complete ? `Du sendes til innlogging om ${redirectSeconds} sekunder.` : reset ? "Lenken er gyldig i 30 minutter og kan brukes én gang." : "Vi sender deg en lenke hvis e-postadressen har en konto."}</p></div>{!complete && <form className="auth-form" onSubmit={submit}>{reset ? <><label>Nytt passord<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required /></label><label>Gjenta passord<input name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={200} required /></label></> : <label>E-post<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>}<button className="primary full" disabled={busy}>{busy ? "Et øyeblikk…" : reset ? "Lagre nytt passord" : "Send passordlenke"}</button></form>}{message && <p className="auth-success" role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}<Link className={complete ? "primary full auth-return" : "auth-back-link"} href={complete ? "/?login=1" : "/"}>{complete ? "Gå til innlogging nå" : "Tilbake til forsiden"}</Link></section></main>;
}
