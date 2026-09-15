"use client";

import {
  AlertTriangle, ArrowLeft, Bell, Building2, CalendarDays, Camera,
  Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, Download, FileText, Gauge, ImagePlus, LayoutDashboard, Menu,
  MoreHorizontal, Package, Plus, Receipt, Search, Send, Settings,
  ShieldCheck, Users, WalletCards, X,
} from "lucide-react";
import { useEffect, useState } from "react";

type Screen = "dashboard" | "order" | "invoice";

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);
  const openOrder = () => { setScreen("order"); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const openInvoice = () => { setScreen("invoice"); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const goDashboard = () => { setScreen("dashboard"); setMenuOpen(false); window.scrollTo({ top: 0 }); };

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
          {screen === "order" && <OrderView goBack={goDashboard} openInvoice={openInvoice} notify={notify} />}
          {screen === "invoice" && <InvoiceView openOrder={openOrder} notify={notify} />}
        </div>
      </main>
      {toast && <div className="save-toast" role="status"><Check />{toast}</div>}
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

function OrderView({ goBack, openInvoice, notify }: { goBack: () => void; openInvoice: () => void; notify: (message: string) => void }) {
  return <div className="order-view">
    <section className="order-hero"><button className="back-button" onClick={goBack}><ArrowLeft />Tilbake til dashboard</button><div className="order-hero-main"><div><p className="eyebrow">Ordre #2048 · Pågår</p><h1>Utskifting av kabel og armatur</h1><div className="order-meta"><span><Building2 />Hansen Bygg AS</span><span><CalendarDays />13.–15. september</span><span>Røyken → Oslo</span></div></div><div className="order-amount"><span>Registrert fakturerbart</span><strong>18 420 kr</strong></div></div></section>
    <div className="quick-actions">
      <Quick icon={Clock3} label="Timer" onClick={() => notify("Timer lagret på ordre #2048")} />
      <Quick icon={Package} label="Linje" onClick={() => notify("Produktlinje lagt til")} />
      <Quick icon={Gauge} label="Kjøring" onClick={() => notify("Kjøring åpnes snart")} />
      <Quick icon={Receipt} label="Utlegg" onClick={() => notify("Utlegg åpnes snart")} />
      <Quick icon={Building2} label="Hotell" onClick={() => notify("Hotellregistrering åpnes snart")} />
      <Quick icon={Camera} label="Bilde" onClick={() => notify("Bildeopplasting åpnes snart")} />
      <Quick icon={FileText} label="Dokument" onClick={() => notify("Dokumentopplasting åpnes snart")} />
    </div>
    <div className="order-columns">
      <section className="panel"><div className="panel-head"><div><h2>Jobbaktivitet</h2><p>Alt som er registrert på ordren</p></div><button className="secondary" onClick={() => notify("Arbeidsnotat lagret")}><Plus />Legg til</button></div><div className="timeline"><div className="timeline-day">Mandag 13. september</div>{events.slice(0,3).map((event, i) => <Event key={i} {...event} />)}<div className="timeline-day">Tirsdag 14. september</div>{events.slice(3).map((event, i) => <Event key={i} {...event} />)}</div></section>
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

function Metric({ icon: Icon, label, value, note, emphasis, positive }: { icon: typeof Gauge; label: string; value: string; note: string; emphasis?: boolean; positive?: boolean }) { return <article className={`metric-card ${emphasis ? "emphasis" : ""}`}><div className="metric-label">{label}<span className="metric-icon"><Icon /></span></div><span className="metric-value">{value}</span><span className={`metric-note ${positive ? "positive" : ""}`}>{note}</span></article>; }
function Action({ icon: Icon, title, text, amber, onClick }: { icon: typeof Gauge; title: string; text: string; amber?: boolean; onClick: () => void }) { return <button className="action-row" onClick={onClick}><span className={`action-icon ${amber ? "amber" : ""}`}><Icon /></span><span><b>{title}</b><span>{text}</span></span><ChevronRight /></button>; }
function Quick({ icon: Icon, label, onClick }: { icon: typeof Gauge; label: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><Icon />+ {label.toUpperCase()}</button>; }
function Event({ icon: Icon, title, text, amount, time }: { icon: typeof Gauge; title: string; text: string; amount: string; time: string }) { return <div className="event"><span className="event-icon"><Icon /></span><div><b>{title}</b><p>{text}</p></div><div className="event-price">{amount}<span>{time}</span></div></div>; }
function CheckLine({ text, warning }: { text: string; warning?: boolean }) { return <div className={`check ${warning ? "warn" : ""}`}>{warning ? <AlertTriangle /> : <CheckCircle2 />}<span>{text}</span></div>; }
