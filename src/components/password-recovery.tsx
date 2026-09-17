"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
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
  return <main className="auth-page"><section className="auth-card"><h1>{reset ? "Velg nytt passord" : "Glemt passord"}</h1><p>{reset ? "Lenken er gyldig i 30 minutter og kan brukes én gang." : "Vi sender deg en lenke hvis e-postadressen har en konto."}</p>{!complete && <form className="auth-form" onSubmit={submit}>{reset ? <><label>Nytt passord<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required /></label><label>Gjenta passord<input name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={200} required /></label></> : <label>E-post<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>}<button className="primary full" disabled={busy}>{busy ? "Et øyeblikk…" : reset ? "Lagre nytt passord" : "Send passordlenke"}</button></form>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}<Link href="/">Til innlogging</Link></section></main>;
}
