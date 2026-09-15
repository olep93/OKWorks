"use client";

import { Building2, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package, Plus, Settings, Users, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name: string; organizationId: string; role: string };
type Customer = { id: string; name: string; organizationNumber: string | null; email: string | null; phone: string | null; address: string | null };
type Order = { id: string; orderNumber: number; title: string; status: string; workAddress: string | null; customerId: string; updatedAt: string };
type AppData = { customers: Customer[]; orders: Order[] };
type Modal = "customer" | "order" | null;
type Screen = "dashboard" | "customers" | "order";

export function OkWorksApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((d) => setUser(d.user ?? null)).catch(() => setUser(null)); }, []);
  if (user === undefined) return <div className="loading-screen"><div className="brand-mark">OK</div><p>Laster OK Works…</p></div>;
  if (!user) return <Login onAuthenticated={setUser} />;
  return <Portal user={user} onLogout={() => setUser(null)} />;
}

function Login({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [step, setStep] = useState<"email" | "password" | "setup">("email");
  const [email, setEmail] = useState("olep93@gmail.com");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const endpoint = step === "email" ? "/api/auth/status" : step === "setup" ? "/api/auth/setup" : "/api/auth/login";
    const body = step === "email" ? { email } : step === "setup" ? { email, setupCode: form.get("setupCode"), password: form.get("password") } : { email, password: form.get("password") };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Noe gikk galt.");
      if (step === "email") { setStep(data.needsSetup ? "setup" : "password"); return; }
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((value) => value.json());
      onAuthenticated(me.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Noe gikk galt."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><div className="brand-mark">OK</div><div><h1>OK Works</h1><p>Fra utført jobb til fakturert</p></div></div>
    <div className="auth-copy"><p className="eyebrow">{step === "setup" ? "Første innlogging" : "Velkommen tilbake"}</p><h2>{step === "setup" ? "Opprett passordet ditt" : "Logg inn"}</h2><p>{step === "setup" ? "Bruk oppstartskoden du har fått, og velg et personlig passord." : "Fortsett med e-postadressen din."}</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>E-post</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={step !== "email"} required /></label>
      {step === "setup" && <label><span>Oppstartskode</span><input name="setupCode" autoComplete="one-time-code" required /></label>}
      {step !== "email" && <label><span>{step === "setup" ? "Velg passord" : "Passord"}</span><input name="password" type="password" autoComplete={step === "setup" ? "new-password" : "current-password"} minLength={step === "setup" ? 10 : 1} required /></label>}
      {error && <p className="form-error">{error}</p>}
      <button className="primary full" disabled={busy}>{busy ? "Et øyeblikk…" : step === "setup" ? "Opprett passord og logg inn" : "Fortsett"}</button>
      {step !== "email" && <button type="button" className="text-button" onClick={() => setStep("email")}>Bruk en annen e-post</button>}
    </form>
  </section></main>;
}

function Portal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [data, setData] = useState<AppData>({ customers: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  async function refresh() { const response = await fetch("/api/app", { cache: "no-store" }); if (response.status === 401) { onLogout(); return; } setData(await response.json()); setLoading(false); }
  useEffect(() => { fetch("/api/app", { cache: "no-store" }).then(async (response) => { if (response.status === 401) { onLogout(); return; } setData(await response.json()); setLoading(false); }); }, [onLogout]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2500); return () => clearTimeout(timer); }, [toast]);
  const customerMap = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);
  const selectedOrder = data.orders.find((order) => order.id === selectedOrderId) ?? null;
  const openOrder = (id: string) => { setSelectedOrderId(id); setScreen("order"); setMenuOpen(false); };
  const navigate = (next: Screen) => { setScreen(next); setMenuOpen(false); };
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); onLogout(); }
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}><div className="brand"><div className="brand-mark">OK</div><div><div className="brand-name">OK Works</div><small>Din arbeidsportal</small></div></div>
      <nav className="nav" aria-label="Hovedmeny"><button className={`nav-button ${screen === "dashboard" ? "active" : ""}`} onClick={() => navigate("dashboard")}><LayoutDashboard />Dashboard</button><button className={`nav-button ${screen === "order" ? "active" : ""}`} onClick={() => navigate("dashboard")}><ClipboardList />Ordre</button><button className={`nav-button ${screen === "customers" ? "active" : ""}`} onClick={() => navigate("customers")}><Users />Kunder</button><button className="nav-button" disabled><FileText />Fakturaer</button><button className="nav-button" disabled><Package />Produkter & tjenester</button><button className="nav-button" disabled><Settings />Innstillinger</button></nav>
      <div className="sidebar-bottom"><div className="user-card"><div className="avatar">OK</div><div><b>{user.name}</b><span>Eier</span></div><button className="icon-button" aria-label="Logg ut" onClick={logout}><LogOut /></button></div></div></aside>
    <main className="main"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button><div className="crumb">OK Works&nbsp;&nbsp;/&nbsp;&nbsp;<strong>{screen === "dashboard" ? "Dashboard" : screen === "customers" ? "Kunder" : selectedOrder ? `Ordre #${selectedOrder.orderNumber}` : "Ordre"}</strong></div></header>
      <div className="content">{loading ? <div className="empty-state"><p>Laster arbeidsområdet…</p></div> : screen === "customers" ? <Customers customers={data.customers} onNew={() => setModal("customer")} /> : screen === "order" && selectedOrder ? <OrderDetails order={selectedOrder} customer={customerMap.get(selectedOrder.customerId)} onBack={() => navigate("dashboard")} /> : <Dashboard data={data} customerMap={customerMap} onNewCustomer={() => setModal("customer")} onNewOrder={() => setModal("order")} onOpenOrder={openOrder} />}</div></main>
    {modal && <CreateModal kind={modal} customers={data.customers} onClose={() => setModal(null)} onCreated={async (message) => { setModal(null); await refresh(); setToast(message); }} />}{toast && <div className="save-toast" role="status">{toast}</div>}
  </div>;
}

function Dashboard({ data, customerMap, onNewCustomer, onNewOrder, onOpenOrder }: { data: AppData; customerMap: Map<string, Customer>; onNewCustomer: () => void; onNewOrder: () => void; onOpenOrder: (id: string) => void }) {
  return <><div className="page-heading"><div><p className="eyebrow">Arbeidsoversikt</p><h1>God dag, Ole.</h1><p className="subhead">Her bygger du opp kundene og ordrene dine.</p></div><div className="heading-actions"><button className="secondary" onClick={onNewCustomer}><Users />Ny kunde</button><button className="primary" onClick={onNewOrder} disabled={!data.customers.length}><Plus />Ny ordre</button></div></div>
    {!data.orders.length ? <section className="panel empty-state"><div className="empty-icon"><ClipboardList /></div><h2>Ingen ordre ennå</h2><p>{data.customers.length ? "Opprett din første ordre og begynn å registrere arbeidet." : "Start med å opprette en kunde. Deretter kan du lage den første ordren."}</p><button className="primary" onClick={data.customers.length ? onNewOrder : onNewCustomer}>{data.customers.length ? <Plus /> : <Users />}{data.customers.length ? "Opprett første ordre" : "Opprett første kunde"}</button></section> : <section className="panel"><div className="panel-head"><div><h2>Aktive ordre</h2><p>{data.orders.length} {data.orders.length === 1 ? "ordre" : "ordrer"}</p></div></div><div className="order-list">{data.orders.map((order) => <button className="order-row" key={order.id} onClick={() => onOpenOrder(order.id)}><div className="order-title"><span>ORDRE #{order.orderNumber}</span>{order.title}</div><div className="order-cell"><strong>{customerMap.get(order.customerId)?.name ?? "Ukjent kunde"}</strong>{order.workAddress || "Ingen arbeidsadresse"}</div><div><span className="status open">Åpen</span></div><ChevronRight /></button>)}</div></section>}
  </>;
}

function Customers({ customers, onNew }: { customers: Customer[]; onNew: () => void }) { return <><div className="page-heading"><div><p className="eyebrow">Kunderegister</p><h1>Kunder</h1><p className="subhead">Kundedata lagres trygt i databasen.</p></div><button className="primary" onClick={onNew}><Plus />Ny kunde</button></div>{customers.length ? <section className="panel customer-list">{customers.map((customer) => <article key={customer.id}><div className="customer-icon"><Building2 /></div><div><h3>{customer.name}</h3><p>{customer.organizationNumber ? `Org.nr. ${customer.organizationNumber}` : "Privatkunde"}</p><span>{customer.email || customer.phone || customer.address || "Ingen kontaktinformasjon"}</span></div></article>)}</section> : <section className="panel empty-state"><h2>Ingen kunder ennå</h2><p>Opprett din første kunde for å komme i gang.</p><button className="primary" onClick={onNew}><Plus />Ny kunde</button></section>}</>; }

function OrderDetails({ order, customer, onBack }: { order: Order; customer?: Customer; onBack: () => void }) { return <div className="order-view"><section className="order-hero"><button className="back-button" onClick={onBack}>← Tilbake til dashboard</button><div className="order-hero-main"><div><p className="eyebrow">Ordre #{order.orderNumber} · Åpen</p><h1>{order.title}</h1><div className="order-meta"><span><Building2 />{customer?.name ?? "Ukjent kunde"}</span><span>{order.workAddress || "Ingen arbeidsadresse"}</span></div></div><div className="order-amount"><span>Registrert fakturerbart</span><strong>0 kr</strong></div></div></section><section className="panel empty-state"><div className="empty-icon"><ClipboardList /></div><h2>Ordren er klar</h2><p>Ingen timer, varer, kjøring eller utlegg er registrert ennå.</p></section></div>; }

function CreateModal({ kind, customers, onClose, onCreated }: { kind: Exclude<Modal, null>; customers: Customer[]; onClose: () => void; onCreated: (message: string) => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const response = await fetch(kind === "customer" ? "/api/customers" : "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await onCreated(kind === "customer" ? "Kunden er opprettet" : `Ordre #${data.order.orderNumber} er opprettet`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Noe gikk galt."); setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="entry-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><h2>{kind === "customer" ? "Opprett kunde" : "Opprett ordre"}</h2><p>{kind === "customer" ? "Legg inn det du har nå. Resten kan fylles ut senere." : "Velg kunde og gi jobben et tydelig navn."}</p></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={submit}><div className="form-grid">{kind === "customer" ? <><Field label="Kundenavn" wide><input name="name" required /></Field><Field label="Organisasjonsnummer"><input name="organizationNumber" /></Field><Field label="E-post"><input name="email" type="email" /></Field><Field label="Telefon"><input name="phone" /></Field><Field label="Adresse" wide><input name="address" /></Field></> : <><Field label="Kunde" wide><select name="customerId" required defaultValue=""><option value="" disabled>Velg kunde</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field><Field label="Tittel" wide><input name="title" placeholder="Hva skal gjøres?" required /></Field><Field label="Arbeidsadresse" wide><input name="workAddress" /></Field><Field label="Beskrivelse" wide><textarea name="description" rows={3} /></Field></>}</div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Avbryt</button><button className="primary" disabled={busy}>{busy ? "Lagrer…" : kind === "customer" ? "Opprett kunde" : "Opprett ordre"}</button></div></form></section></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
