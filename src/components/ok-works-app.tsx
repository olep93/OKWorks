"use client";

import {
  AlertTriangle, ArrowLeft, Bell, Building2, CalendarDays, Camera,
  Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, Download, FileText, Gauge, ImagePlus, LayoutDashboard, Menu,
  MoreHorizontal, Package, Plus, Receipt, Search, Send, Settings,
  ShieldCheck, Users, WalletCards, X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Screen = "dashboard" | "order" | "invoice";
type EntryKind = "Timer" | "Linje" | "Kjøring" | "Utlegg" | "Hotell" | "Bilde" | "Dokument";
type TimelineEvent = { icon: typeof Gauge; title: string; text: string; amount: string; time: string };

const orders = [
  { id: "2048", title: "Utskifting av kabel og armatur", customer: "Hansen Bygg AS", place: "Røyken → Oslo", amount: "18 420 kr", status: "Pågår", tone: "progress" },
  { id: "2047", title: "Service ventilasjonsanlegg", customer: "Holmen Kontor AS", place: "Asker", amount: "8 790 kr", status: "Klar til faktura", tone: "ready" },
  { id: "2046", title: "Feilsøking sikringsskap", customer: "Kari Nilsen", place: "Drammen", amount: "4 140 kr", status: "Åpen", tone: "open" },
  { id: "2045", title: "Montering utebelysning", customer: "Fjordtun Sameie", place: "Slemmestad", amount: "12 680 kr", status: "Pågår", tone: "progress" },
];

const events = [
  { icon: Clock3, title: "Arbeidstid · 2 timer", text: "Feilsøking og demontering", amount: "1 580 kr", time: "08:15" },
  { icon: Package, title: "Materiell · 14 m kabel", text: "Kabel 3G2,5 mm²", amount: "406 kr", time: "10:22" },
  { icon: Camera, title: "2 arbeidsbilder", text: "Før · Avvik/skade", amount: "Dokumentert", time: "11:04" },
  { icon: Clock3, title: "Arbeidstid · 3,5 timer", text: "Ny kabel og armatur montert", amount: "2 765 kr", time: "I går" },
  { icon: ImagePlus, title: "Etter-bilde", text: "Ferdig resultat og funksjonstest", amount: "Dokumentert", time: "I går" },
];

export function OkWorksApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<EntryKind | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(events);
  const [addedAmount, setAddedAmount] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);
  const openOrder = () => { setScreen("order"); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const openInvoice = () => { setScreen("invoice"); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const goDashboard = () => { setScreen("dashboard"); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const addEntry = (entry: TimelineEvent, amountOre: number) => {
    setTimelineEvents((current) => [...current, entry]);
    setAddedAmount((current) => current + amountOre);
    setActiveForm(null);
    notify(`${entry.title} er lagret`);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">OK</div><div><div className="brand-name">OK Works</div><small>Verkly Demo AS</small></div></div>
        <nav className="nav" aria-label="Hovedmeny">
          <button className={`nav-button ${screen === "dashboard" ? "active" : ""}`} onClick={goDashboard}><LayoutDashboard />Dashboard</button>
          <button className={`nav-button ${screen === "order" ? "active" : ""}`} onClick={openOrder}><ClipboardList />Ordre</button>
          <button className="nav-button" onClick={() => notify("Kundearkivet kommer i neste leveranse")}><Users />Kunder</button>
          <button className={`nav-button ${screen === "invoice" ? "active" : ""}`} onClick={openInvoice}><FileText />Fakturaer</button>
          <button className="nav-button" onClick={() => notify("Produktregisteret klargjøres")}><Package />Produkter & tjenester</button>
          <button className="nav-button" onClick={() => notify("Firmainnstillinger kommer snart")}><Settings />Innstillinger</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><b>Alt på stell?</b>Ferdigstillingskontrollen hjelper deg å finne mangler før fakturaen sendes.</div>
          <div className="user-card"><div className="avatar">OK</div><div><b>Ole Kristiansen</b><span>Eier</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={menuOpen ? "Lukk meny" : "Åpne meny"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          <div className="crumb">OK Works&nbsp;&nbsp;/&nbsp;&nbsp;<strong>{screen === "dashboard" ? "Dashboard" : screen === "order" ? "Ordre #2048" : "Fakturautkast"}</strong></div>
          <div className="top-actions"><button className="icon-button" aria-label="Søk" onClick={() => notify("Søk åpnes snart")}><Search /></button><button className="icon-button" aria-label="Varsler" onClick={() => notify("Ingen nye varsler")}><Bell /></button></div>
        </header>
        <div className="content">
          {screen === "dashboard" && <Dashboard openOrder={openOrder} notify={notify} />}
          {screen === "order" && <OrderView goBack={goDashboard} openInvoice={openInvoice} openForm={setActiveForm} events={timelineEvents} addedAmount={addedAmount} />}
          {screen === "invoice" && <InvoiceView openOrder={openOrder} notify={notify} />}
        </div>
      </main>
      {toast && <div className="save-toast" role="status"><Check />{toast}</div>}
      {activeForm && <EntryModal kind={activeForm} onClose={() => setActiveForm(null)} onSave={addEntry} />}
    </div>
  );
}

function Dashboard({ openOrder, notify }: { openOrder: () => void; notify: (message: string) => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">Tirsdag 15. september</p><h1>God morgen, Ole.</h1><p className="subhead">Her er det som trenger oppmerksomheten din i dag.</p></div><button className="primary" onClick={() => notify("Ny ordre-skjema åpnes i neste leveranse")}><Plus /><span>Ny ordre</span></button></div>
    <section className="metric-grid" aria-label="Nøkkeltall">
      <Metric icon={CircleDollarSign} label="Fakturert i september" value="84 260 kr" note="↑ 12 % fra august" positive />
      <Metric icon={WalletCards} label="Utestående" value="46 780 kr" note="3 åpne fakturaer" />
      <Metric icon={AlertTriangle} label="Forfalt" value="8 450 kr" note="1 faktura · 6 dager" />
      <Metric icon={Gauge} label="Klar til fakturering" value="2 jobber" note="17 480 kr registrert" emphasis />
    </section>
    <div className="work-grid">
      <section className="panel"><div className="panel-head"><div><h2>Aktive ordre</h2><p>4 jobber pågår eller venter</p></div><button className="ghost" onClick={() => notify("Viser alle aktive ordre")}>Se alle <ChevronRight /></button></div><div className="order-list">{orders.map((order) => <button className="order-row" key={order.id} onClick={openOrder}><div className="order-title"><span>ORDRE #{order.id}</span>{order.title}</div><div className="order-cell"><strong>{order.customer}</strong>{order.place}</div><div className="order-cell"><strong>{order.amount}</strong>Registrert</div><div><span className={`status ${order.tone}`}>{order.status}</span></div><ChevronRight /></button>)}</div></section>
      <div className="right-stack">
        <section className="panel"><div className="panel-head"><div><h2>Gjør dette nå</h2><p>Prioritert for deg</p></div><MoreHorizontal /></div><div className="action-list"><Action icon={FileText} title="Fakturer ordre #2047" text="8 790 kr er klart" onClick={openOrder} /><Action icon={AlertTriangle} title="Følg opp faktura #1008" text="Forfalt med 6 dager" amber onClick={() => notify("Faktura #1008 åpnes snart")} /><Action icon={Clock3} title="Fortsett ordre #2048" text="Sist endret i går" onClick={openOrder} /></div></section>
        <section className="panel"><div className="panel-head"><div><h2>Månedens flyt</h2><p>Fra jobb til betalt</p></div></div><div className="progress-wrap"><div className="progress-ring"><span className="progress-number">79%</span></div><div className="progress-label">15 av 19 ferdige jobber er fakturert.<br/><strong>4 jobber gjenstår.</strong></div></div></section>
      </div>
    </div>
  </>;
}

function OrderView({ goBack, openInvoice, openForm, events, addedAmount }: { goBack: () => void; openInvoice: () => void; openForm: (kind: EntryKind) => void; events: TimelineEvent[]; addedAmount: number }) {
  const total = new Intl.NumberFormat("nb-NO").format(18_420 + Math.round(addedAmount / 100));
  return <div className="order-view">
    <section className="order-hero"><button className="back-button" onClick={goBack}><ArrowLeft />Tilbake til dashboard</button><div className="order-hero-main"><div><p className="eyebrow">Ordre #2048 · Pågår</p><h1>Utskifting av kabel og armatur</h1><div className="order-meta"><span><Building2 />Hansen Bygg AS</span><span><CalendarDays />13.–15. september</span><span>Røyken → Oslo</span></div></div><div className="order-amount"><span>Registrert fakturerbart</span><strong>{total} kr</strong></div></div></section>
    <div className="quick-actions">
      <Quick icon={Clock3} label="Timer" onClick={() => openForm("Timer")} />
      <Quick icon={Package} label="Linje" onClick={() => openForm("Linje")} />
      <Quick icon={Gauge} label="Kjøring" onClick={() => openForm("Kjøring")} />
      <Quick icon={Receipt} label="Utlegg" onClick={() => openForm("Utlegg")} />
      <Quick icon={Building2} label="Hotell" onClick={() => openForm("Hotell")} />
      <Quick icon={Camera} label="Bilde" onClick={() => openForm("Bilde")} />
      <Quick icon={FileText} label="Dokument" onClick={() => openForm("Dokument")} />
    </div>
    <div className="order-columns">
      <section className="panel"><div className="panel-head"><div><h2>Jobbaktivitet</h2><p>Alt som er registrert på ordren</p></div><button className="secondary" onClick={() => openForm("Timer")}><Plus />Legg til</button></div><div className="timeline"><div className="timeline-day">Registrert på ordren</div>{events.map((event, i) => <Event key={`${event.title}-${i}`} {...event} />)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Ferdigstill jobb</h2><p>Kontroller før fakturering</p></div></div><div className="preflight"><div className="check-summary"><div className="check-summary-icon"><CheckCircle2 /></div><div><b>Jobben er nesten klar</b><span>6 kontroller bestått · 1 advarsel</span></div></div><div className="check-list"><CheckLine text="5,5 timer registrert" /><CheckLine text="Materialer og kjøring registrert" /><CheckLine text="Før- og etter-bilder finnes" /><CheckLine text="Dokumentasjon er knyttet til ordren" /><CheckLine text="Arbeidsbeskrivelsen er kort" warning /></div><button className="primary highlight full" onClick={openInvoice}><CheckCircle2 />Kjør ferdigstillingskontroll</button></div></section>
    </div>
  </div>;
}

function InvoiceView({ openOrder, notify }: { openOrder: () => void; notify: (message: string) => void }) {
  const lines = [
    ["Arbeidstime", "5,5 timer", "790 kr", "4 345 kr"],
    ["Kabel 3G2,5 mm²", "14 m", "29 kr", "406 kr"],
    ["Armatur 40W", "1 stk", "449 kr", "449 kr"],
    ["Kjøring Røyken–Oslo t/r", "92,6 km", "6,50 kr", "602 kr"],
    ["Hotell inkl. 10 % påslag", "1 natt", "1 639 kr", "1 639 kr"],
  ];
  return <div className="invoice-view">
    <div className="invoice-top"><div><button className="back-button dark" onClick={openOrder}><ArrowLeft />Tilbake til ordre #2048</button><p className="eyebrow">Fakturautkast</p><h1>Klar for siste kontroll</h1><p className="subhead">Utkastet er ikke låst eller sendt ennå.</p></div><div className="invoice-actions"><button className="secondary" onClick={() => notify("PDF-forhåndsvisning klargjøres")}><Download />Forhåndsvis PDF</button><button className="primary" onClick={() => notify("Demo: Fakturaen er kontrollert, men ikke sendt")}><Send />Finaliser og send</button></div></div>
    <div className="invoice-layout">
      <section className="invoice-paper">
        <div className="invoice-paper-head"><div className="invoice-logo"><span>OK</span><b>Verkly Demo AS</b></div><div className="invoice-title"><span>FAKTURAUTKAST</span><strong># Neste nummer</strong></div></div>
        <div className="invoice-parties"><div><small>FAKTURERES TIL</small><b>Hansen Bygg AS</b><span>Industriveien 12<br/>3470 Slemmestad<br/>Org.nr. 923 456 789</span></div><div className="invoice-dates"><p><span>Ordre</span><b>#2048</b></p><p><span>Fakturadato</span><b>15.09.2026</b></p><p><span>Forfall</span><b>29.09.2026</b></p></div></div>
        <div className="invoice-table"><div className="invoice-table-row head"><span>Beskrivelse</span><span>Antall</span><span>Pris</span><span>Beløp</span></div>{lines.map((line) => <div className="invoice-table-row" key={line[0]}>{line.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div>
        <div className="invoice-totals"><p><span>Netto</span><b>14 736 kr</b></p><p><span>MVA 25 %</span><b>3 684 kr</b></p><p className="grand-total"><span>Å betale</span><b>18 420 kr</b></p></div>
        <div className="invoice-footer"><span>Bankkonto 1503.44.56789</span><span>Betalingsfrist 14 dager</span></div>
      </section>
      <aside className="invoice-checks panel"><div className="panel-head"><div><h2>Siste kontroll</h2><p>Grunnlaget er snapshot-klart</p></div></div><div className="invoice-check-body"><div className="secure-note"><ShieldCheck /><div><b>Trygg finalisering</b><span>Fakturanummer tildeles atomisk. Beløp og kundeinformasjon låses når du finaliserer.</span></div></div><div className="check-list"><CheckLine text="Alle valgte poster er ufakturerte" /><CheckLine text="Kundeinformasjon er komplett" /><CheckLine text="MVA og summer er beregnet" /><CheckLine text="Dokumentasjonsrapport kan vedlegges" /><CheckLine text="Arbeidsbeskrivelsen er kort" warning /></div><label className="confirm-row"><input type="checkbox" defaultChecked /><span>Jeg har kontrollert fakturagrunnlaget</span></label></div></aside>
    </div>
  </div>;
}

const formCopy: Record<EntryKind, { title: string; intro: string; icon: typeof Gauge }> = {
  Timer: { title: "Registrer timer", intro: "Legg arbeidstid til ordre #2048.", icon: Clock3 },
  Linje: { title: "Legg til produkt eller tjeneste", intro: "Pris og MVA kan justeres før lagring.", icon: Package },
  Kjøring: { title: "Registrer kjøring", intro: "Ruteberegning kobles på senere; demoen bruker oppgitt km.", icon: Gauge },
  Utlegg: { title: "Registrer utlegg", intro: "Faktisk kostnad holdes separat fra fakturerbart beløp.", icon: Receipt },
  Hotell: { title: "Registrer hotell", intro: "Påslag beregnes fra kostnaden du oppgir.", icon: Building2 },
  Bilde: { title: "Legg til arbeidsbilde", intro: "Klassifiser bildet for automatisk arbeidsrapport.", icon: Camera },
  Dokument: { title: "Legg til dokument", intro: "Dokumentet knyttes til denne ordren.", icon: FileText },
};

function EntryModal({ kind, onClose, onSave }: { kind: EntryKind; onClose: () => void; onSave: (entry: TimelineEvent, amountOre: number) => void }) {
  const copy = formCopy[kind];
  const Icon = copy.icon;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string, fallback = "") => String(data.get(name) || fallback);
    const numeric = (name: string) => Number(value(name, "0").replace(",", ".")) || 0;
    let entry: TimelineEvent;
    let amountOre = 0;

    if (kind === "Timer") {
      const hours = numeric("hours"); const rate = numeric("rate"); amountOre = Math.round(hours * rate * 100);
      entry = { icon: Clock3, title: `Arbeidstid · ${hours} timer`, text: value("description", "Utført arbeid"), amount: `${Math.round(amountOre / 100).toLocaleString("nb-NO")} kr`, time: "Nå" };
    } else if (kind === "Linje") {
      const quantity = numeric("quantity"); const price = numeric("price"); amountOre = Math.round(quantity * price * 100);
      entry = { icon: Package, title: `${value("product", "Produkt")} · ${quantity} ${value("unit", "stk")}`, text: value("description", "Produktlinje"), amount: `${Math.round(amountOre / 100).toLocaleString("nb-NO")} kr`, time: "Nå" };
    } else if (kind === "Kjøring") {
      const km = numeric("km"); const rate = numeric("rate"); amountOre = Math.round(km * rate * 100);
      entry = { icon: Gauge, title: `Kjøring · ${km} km`, text: `${value("origin")} → ${value("destination")}`, amount: `${Math.round(amountOre / 100).toLocaleString("nb-NO")} kr`, time: "Nå" };
    } else if (kind === "Utlegg") {
      const cost = numeric("cost"); const markup = numeric("markup"); amountOre = Math.round(cost * (1 + markup / 100) * 100);
      entry = { icon: Receipt, title: `${value("expenseType", "Utlegg")} · ${value("vendor", "Leverandør")}`, text: `Kostnad ${cost.toLocaleString("nb-NO")} kr · ${markup}% påslag`, amount: `${Math.round(amountOre / 100).toLocaleString("nb-NO")} kr`, time: "Nå" };
    } else if (kind === "Hotell") {
      const cost = numeric("cost"); const markup = numeric("markup"); amountOre = Math.round(cost * (1 + markup / 100) * 100);
      entry = { icon: Building2, title: `${value("hotel", "Hotell")} · ${value("nights", "1")} natt`, text: `Kostnad ${cost.toLocaleString("nb-NO")} kr · ${markup}% påslag`, amount: `${Math.round(amountOre / 100).toLocaleString("nb-NO")} kr`, time: "Nå" };
    } else if (kind === "Bilde") {
      const file = data.get("file") as File | null;
      entry = { icon: Camera, title: `Arbeidsbilde · ${value("category", "Annet")}`, text: value("caption", file?.name || "Bilde uten bildetekst"), amount: "Dokumentert", time: "Nå" };
    } else {
      const file = data.get("file") as File | null;
      entry = { icon: FileText, title: value("title", "Dokument"), text: file?.name || "Dokument registrert", amount: "Vedlegg", time: "Nå" };
    }
    onSave(entry, amountOre);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
      <div className="modal-head"><div className="modal-title-icon"><Icon /></div><div><h2 id="entry-modal-title">{copy.title}</h2><p>{copy.intro}</p></div><button type="button" className="icon-button" aria-label="Lukk" onClick={onClose}><X /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">{kind === "Timer" && <>
          <Field label="Dato"><input name="date" type="date" defaultValue="2026-09-15" required /></Field>
          <Field label="Antall timer"><input name="hours" type="number" min="0.25" step="0.25" defaultValue="1.5" required /></Field>
          <Field label="Timesats"><input name="rate" type="number" min="0" defaultValue="790" required /></Field>
          <Field label="Beskrivelse" wide><input name="description" defaultValue="Montering og funksjonstest" required /></Field>
        </>}{kind === "Linje" && <>
          <Field label="Produkt / tjeneste" wide><select name="product" defaultValue="Kabel 3G2,5 mm²"><option>Kabel 3G2,5 mm²</option><option>Arbeidstime</option><option>Lampe 40W</option><option>Smusstillegg</option></select></Field>
          <Field label="Antall"><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="2" required /></Field>
          <Field label="Enhet"><select name="unit"><option>stk</option><option>m</option><option>timer</option></select></Field>
          <Field label="Pris"><input name="price" type="number" min="0" defaultValue="29" required /></Field>
          <Field label="Beskrivelse"><input name="description" defaultValue="Tilleggsmateriell" /></Field>
        </>}{kind === "Kjøring" && <>
          <Field label="Fra"><input name="origin" defaultValue="Røyken" required /></Field><Field label="Til"><input name="destination" defaultValue="Oslo" required /></Field>
          <Field label="Kilometer"><input name="km" type="number" min="0" step="0.1" defaultValue="46.3" required /></Field><Field label="Kr per km"><input name="rate" type="number" min="0" step="0.01" defaultValue="6.50" required /></Field>
          <label className="check-input wide"><input name="roundTrip" type="checkbox" defaultChecked />Tur-retur er inkludert i kilometeren</label>
        </>}{kind === "Utlegg" && <>
          <Field label="Type"><select name="expenseType"><option>Materiell</option><option>Parkering</option><option>Taxi</option><option>Ferge</option><option>Annet</option></select></Field>
          <Field label="Leverandør"><input name="vendor" defaultValue="Byggmakker" required /></Field><Field label="Faktisk kostnad"><input name="cost" type="number" min="0" step="0.01" defaultValue="249" required /></Field><Field label="Påslag %"><input name="markup" type="number" min="0" step="0.1" defaultValue="10" /></Field>
        </>}{kind === "Hotell" && <>
          <Field label="Hotell"><input name="hotel" defaultValue="Scandic" required /></Field><Field label="Antall netter"><input name="nights" type="number" min="1" defaultValue="1" required /></Field><Field label="Faktisk kostnad"><input name="cost" type="number" min="0" step="0.01" defaultValue="1490" required /></Field><Field label="Påslag %"><input name="markup" type="number" min="0" step="0.1" defaultValue="10" /></Field>
        </>}{kind === "Bilde" && <>
          <Field label="Bildetype"><select name="category"><option>Før</option><option>Avvik/skade</option><option>Under arbeid</option><option>Etter</option><option>Annet</option></select></Field><Field label="Velg bilde"><input name="file" type="file" accept="image/*" /></Field><Field label="Bildetekst" wide><input name="caption" defaultValue="Ferdig resultat" required /></Field>
        </>}{kind === "Dokument" && <>
          <Field label="Tittel"><input name="title" defaultValue="Arbeidsdokumentasjon" required /></Field><Field label="Velg dokument"><input name="file" type="file" accept=".pdf,.doc,.docx,image/*" /></Field>
        </>}</div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Avbryt</button><button type="submit" className="primary"><Check />Lagre på ordren</button></div>
      </form>
    </section>
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }

function Metric({ icon: Icon, label, value, note, emphasis, positive }: { icon: typeof Gauge; label: string; value: string; note: string; emphasis?: boolean; positive?: boolean }) { return <article className={`metric-card ${emphasis ? "emphasis" : ""}`}><div className="metric-label">{label}<span className="metric-icon"><Icon /></span></div><span className="metric-value">{value}</span><span className={`metric-note ${positive ? "positive" : ""}`}>{note}</span></article>; }
function Action({ icon: Icon, title, text, amber, onClick }: { icon: typeof Gauge; title: string; text: string; amber?: boolean; onClick: () => void }) { return <button className="action-row" onClick={onClick}><span className={`action-icon ${amber ? "amber" : ""}`}><Icon /></span><span><b>{title}</b><span>{text}</span></span><ChevronRight /></button>; }
function Quick({ icon: Icon, label, onClick }: { icon: typeof Gauge; label: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><Icon />+ {label.toUpperCase()}</button>; }
function Event({ icon: Icon, title, text, amount, time }: { icon: typeof Gauge; title: string; text: string; amount: string; time: string }) { return <div className="event"><span className="event-icon"><Icon /></span><div><b>{title}</b><p>{text}</p></div><div className="event-price">{amount}<span>{time}</span></div></div>; }
function CheckLine({ text, warning }: { text: string; warning?: boolean }) { return <div className={`check ${warning ? "warn" : ""}`}>{warning ? <AlertTriangle /> : <CheckCircle2 />}<span>{text}</span></div>; }
