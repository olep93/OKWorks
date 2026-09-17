"use client";

import {
  AlertTriangle,
  Banknote,
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Hotel,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { formatBankAccount } from "@/lib/bank-account-format";
import { formatMoney, formatQuantity, formatDate, localDate } from "@/lib/format";

type User = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
};
type Customer = {
  id: string;
  type: string;
  name: string;
  organizationNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};
type Order = {
  id: string;
  orderNumber: number;
  title: string;
  status: string;
  workAddress: string | null;
  customerId: string;
  updatedAt: string;
};
type AppData = {
  customers: Customer[];
  orders: Order[];
  onboarding?: { complete: boolean; completed: number; total: number };
};
type ProfileData = {
  organization: Record<string, string | number | null>;
  settings: { mileageRateOre: number; dietDayRateOre: number; dietOvernightRateOre: number; hotelMarkupBasisPoints: number; expenseMarkupBasisPoints: number; vehicleName?: string | null; vehicleFuelType?: string; vehicleAutoPass?: boolean };
  products: Array<{
    id: string;
    name: string;
    unit: string;
    defaultPriceOre: number;
    vatBasisPoints: number;
    category: string | null;
  }>;
};
type Modal = "customer" | "order" | null;
type Screen =
  | "dashboard"
  | "orders"
  | "customers"
  | "order"
  | "invoices"
  | "invoice"
  | "products"
  | "bank"
  | "settings";
type PortalRoute = {
  screen: Screen;
  orderId: string | null;
  invoiceId: string | null;
};
type EntryKind =
  | "LINE"
  | "DRIVING"
  | "EXPENSE"
  | "HOTEL"
  | "IMAGE"
  | "DOCUMENT";
type ExtraEntry = {
  id: string;
  kind: EntryKind;
  workDate: string;
  title: string;
  description: string | null;
  quantityThousandths: number | null;
  unit: string | null;
  unitRateOre: number | null;
  amountOre: number;
  fileName: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown> | null;
};
type EditableRegistration = { id: string; type: "TIME" | "EXTRA"; kind: string; workDate: string; title: string; description: string | null; quantity: number; rateOre: number; amountOre: number; fileName?: string | null; mimeType?: string | null; metadata?: Record<string, unknown> | null };
const orderStatusLabel = (status: string) =>
  status === "INVOICED"
    ? "Fakturert · ubetalt"
    : status === "CLOSED"
      ? "Betalt"
      : status === "CANCELLED"
        ? "Kansellert"
        : "Åpen";
const orderStatusClass = (status: string) =>
  status === "INVOICED" ? "ready" : status === "CLOSED" ? "progress" : "open";

const topLevelScreens: Screen[] = [
  "dashboard",
  "orders",
  "customers",
  "invoices",
  "products",
  "bank",
  "settings",
];

function readPortalRoute(): PortalRoute {
  if (typeof window === "undefined")
    return { screen: "dashboard", orderId: null, invoiceId: null };
  const [view, encodedId] = window.location.hash.replace(/^#\/?/, "").split("/");
  const id = encodedId ? decodeURIComponent(encodedId) : null;
  if (view === "order" && id)
    return { screen: "order", orderId: id, invoiceId: null };
  if (view === "invoice" && id)
    return { screen: "invoice", orderId: null, invoiceId: id };
  if (topLevelScreens.includes(view as Screen))
    return { screen: view as Screen, orderId: null, invoiceId: null };
  return { screen: "dashboard", orderId: null, invoiceId: null };
}

function portalHash(screen: Screen, id?: string) {
  return `#/${screen}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/") || file.size < 700_000) return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.78),
  );
  return blob
    ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      })
    : file;
}

export function OkWorksApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);
  if (user === undefined)
    return (
      <div className="loading-screen">
        <div className="brand-mark">OK</div>
        <p>Laster OK Works…</p>
      </div>
    );
  if (!user) return <Login onAuthenticated={setUser} />;
  return <Portal user={user} onLogout={() => setUser(null)} />;
}

function Login({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [step, setStep] = useState<"email" | "password" | "setup" | "register">(
    "email",
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const endpoint =
      step === "email"
        ? "/api/auth/status"
        : step === "setup"
          ? "/api/auth/setup"
          : step === "register"
            ? "/api/auth/register"
            : "/api/auth/login";
    const body =
      step === "email"
        ? { email }
        : step === "setup"
          ? {
              email,
              setupCode: form.get("setupCode"),
              password: form.get("password"),
            }
          : step === "register"
            ? {
                name: form.get("name"),
                email,
                companyName: form.get("companyName"),
                organizationNumber: form.get("organizationNumber"),
                password: form.get("password"),
                acceptedTerms: form.get("acceptedTerms") === "on",
              }
            : { email, password: form.get("password") };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Noe gikk galt.");
      if (step === "email") {
        setStep(data.needsSetup ? "setup" : "password");
        return;
      }
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then(
        (value) => value.json(),
      );
      onAuthenticated(me.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">OK</div>
          <div>
            <h1>OK Works</h1>
            <p>Fra utført jobb til fakturert</p>
          </div>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">
            {step === "register"
              ? "Nytt firma"
              : step === "setup"
                ? "Første innlogging"
                : "Velkommen tilbake"}
          </p>
          <h2>
            {step === "register"
              ? "Opprett arbeidsområdet"
              : step === "setup"
                ? "Opprett passordet ditt"
                : "Logg inn"}
          </h2>
          <p>
            {step === "register"
              ? "Du blir eier av et separat firmaområde."
              : step === "setup"
                ? "Bruk oppstartskoden du har fått, og velg et personlig passord."
                : "Fortsett med e-postadressen din."}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {step === "register" && (
            <>
              <label>
                <span>Navnet ditt</span>
                <input name="name" autoComplete="name" required />
              </label>
              <label>
                <span>Firmanavn</span>
                <input
                  name="companyName"
                  autoComplete="organization"
                  required
                />
              </label>
              <label>
                <span>Organisasjonsnummer (valgfritt)</span>
                <input name="organizationNumber" inputMode="numeric" />
              </label>
            </>
          )}
          <label>
            <span>E-post</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={step !== "email" && step !== "register"}
              required
            />
          </label>
          {step === "setup" && (
            <label>
              <span>Oppstartskode</span>
              <input name="setupCode" autoComplete="one-time-code" required />
            </label>
          )}
          {step !== "email" && (
            <label>
              <span>
                {step === "setup" || step === "register"
                  ? "Velg passord"
                  : "Passord"}
              </span>
              <input
                name="password"
                type="password"
                autoComplete={
                  step === "setup" || step === "register"
                    ? "new-password"
                    : "current-password"
                }
                minLength={step === "setup" || step === "register" ? 10 : 1}
                required
              />
            </label>
          )}
          {step === "register" && (
            <label className="terms-row">
              <input name="acceptedTerms" type="checkbox" required />
              <span>
                Jeg bekrefter at opplysningene er riktige og godtar at
                firmaområdet opprettes.
              </span>
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Et øyeblikk…"
              : step === "register"
                ? "Opprett firma og logg inn"
                : step === "setup"
                  ? "Opprett passord og logg inn"
                  : "Fortsett"}
          </button>
          {step !== "email" && (
            <button
              type="button"
              className="text-button"
              onClick={() => setStep("email")}
            >
              Bruk en annen e-post
            </button>
          )}
          {step === "email" && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setStep("register");
              }}
            >
              Nytt firma? Opprett konto
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function Portal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const initialRoute = useMemo(() => readPortalRoute(), []);
  const [data, setData] = useState<AppData>({ customers: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>(initialRoute.screen);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialRoute.orderId,
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    initialRoute.invoiceId,
  );
  const [modal, setModal] = useState<Modal>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  async function refresh() {
    const response = await fetch("/api/app", { cache: "no-store" });
    if (response.status === 401) {
      onLogout();
      return;
    }
    setData(await response.json());
    setLoading(false);
  }
  useEffect(() => {
    fetch("/api/app", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) {
        onLogout();
        return;
      }
      const value = await response.json();
      setData(value);
      if (
        !value.onboarding?.complete &&
        !value.customers?.length &&
        !value.orders?.length
      ) {
        setScreen("settings");
        window.history.replaceState(null, "", portalHash("settings"));
      }
      setLoading(false);
    });
  }, [onLogout]);
  useEffect(() => {
    const restoreRoute = () => {
      const route = readPortalRoute();
      setScreen(route.screen);
      setSelectedOrderId(route.orderId);
      setSelectedInvoiceId(route.invoiceId);
      setModal(null);
      setEditingCustomer(null);
      setMenuOpen(false);
    };
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  const customerMap = useMemo(
    () => new Map(data.customers.map((customer) => [customer.id, customer])),
    [data.customers],
  );
  const selectedOrder =
    data.orders.find((order) => order.id === selectedOrderId) ?? null;
  const openOrder = (id: string) => {
    window.history.pushState(null, "", portalHash("order", id));
    setSelectedOrderId(id);
    setScreen("order");
    setMenuOpen(false);
  };
  const openInvoice = (id: string) => {
    window.history.pushState(null, "", portalHash("invoice", id));
    setSelectedInvoiceId(id);
    setScreen("invoice");
    setMenuOpen(false);
  };
  const navigate = (next: Screen, historyMode: "push" | "replace" = "push") => {
    const hash = portalHash(next);
    if (window.location.hash !== hash)
      window.history[historyMode === "replace" ? "replaceState" : "pushState"](
        null,
        "",
        hash,
      );
    setScreen(next);
    setSelectedOrderId(null);
    setSelectedInvoiceId(null);
    setMenuOpen(false);
  };
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">OK</div>
          <div>
            <div className="brand-name">OK Works</div>
            <small>Din arbeidsportal</small>
          </div>
        </div>
        <nav className="nav" aria-label="Hovedmeny">
          <button
            className={`nav-button ${screen === "dashboard" ? "active" : ""}`}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard />
            Dashboard
          </button>
          <button
            className={`nav-button ${screen === "orders" || screen === "order" ? "active" : ""}`}
            onClick={() => navigate("orders")}
          >
            <ClipboardList />
            Ordre
          </button>
          <button
            className={`nav-button ${screen === "customers" ? "active" : ""}`}
            onClick={() => navigate("customers")}
          >
            <Users />
            Kunder
          </button>
          <button
            className={`nav-button ${screen === "invoices" || screen === "invoice" ? "active" : ""}`}
            onClick={() => navigate("invoices")}
          >
            <FileText />
            Fakturaer
          </button>
          <button
            className={`nav-button ${screen === "products" ? "active" : ""}`}
            onClick={() => navigate("products")}
          >
            <Package />
            Produkter & tjenester
          </button>
          <button
            className={`nav-button ${screen === "bank" ? "active" : ""}`}
            onClick={() => navigate("bank")}
          >
            <Banknote />
            Bank og betaling
          </button>
          <button
            className={`nav-button ${screen === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings />
            Innstillinger
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">OK</div>
            <div>
              <b>{user.name}</b>
              <span>Eier</span>
            </div>
            <button
              className="icon-button"
              aria-label="Logg ut"
              onClick={logout}
            >
              <LogOut />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <div className="crumb">
            OK Works&nbsp;&nbsp;/&nbsp;&nbsp;
            <strong>
              {screen === "dashboard"
                ? "Dashboard"
                : screen === "customers"
                  ? "Kunder"
                  : screen === "bank"
                    ? "Bank og betaling"
                    : screen === "products"
                      ? "Produkter og tjenester"
                    : screen === "settings"
                      ? "Firmaprofil"
                      : screen === "orders"
                        ? "Ordre"
                        : screen === "invoices" || screen === "invoice"
                          ? "Fakturaer"
                          : selectedOrder
                            ? `Ordre #${selectedOrder.orderNumber}`
                            : "Ordre"}
            </strong>
          </div>
        </header>
        <div className="content">
          {loading ? (
            <div className="empty-state">
              <p>Laster arbeidsområdet…</p>
            </div>
          ) : screen === "bank" ? (
            <BankScreen />
          ) : screen === "products" ? (
            <ProductsScreen onSaved={setToast} />
          ) : screen === "settings" ? (
            <SettingsScreen
              onSaved={(message) => {
                setToast(message);
                void refresh();
              }}
              onboarding={data.onboarding}
            />
          ) : screen === "invoices" ? (
            <InvoicesScreen onOpen={openInvoice} />
          ) : screen === "invoice" && selectedInvoiceId ? (
            <InvoiceScreen
              invoiceId={selectedInvoiceId}
              onBack={() => navigate("invoices")}
              onReset={async (orderId) => { await refresh(); openOrder(orderId); }}
            />
          ) : screen === "customers" ? (
            <Customers
              customers={data.customers}
              onNew={() => setModal("customer")}
              onEdit={(customer) => {
                setEditingCustomer(customer);
                setModal("customer");
              }}
            />
          ) : screen === "orders" ? (
            <Orders
              data={data}
              customerMap={customerMap}
              onNew={() => setModal("order")}
              onOpen={openOrder}
            />
          ) : screen === "order" && selectedOrder ? (
            <OrderDetails
              order={selectedOrder}
              customer={customerMap.get(selectedOrder.customerId)}
              onBack={() => navigate("orders")}
              onInvoice={openInvoice}
              onDeleted={async () => {
                setSelectedOrderId(null);
                await refresh();
                navigate("orders", "replace");
                setToast("Ordren er slettet");
              }}
            />
          ) : (
            <Dashboard
              user={user}
              data={data}
              customerMap={customerMap}
              onNewCustomer={() => setModal("customer")}
              onNewOrder={() => setModal("order")}
              onOpenOrder={openOrder}
            />
          )}
        </div>
      </main>
      {modal && (
        <CreateModal
          kind={modal}
          customers={data.customers}
          customer={editingCustomer}
          onClose={() => { setModal(null); setEditingCustomer(null); }}
          onCreated={async (message) => {
            setModal(null);
            setEditingCustomer(null);
            await refresh();
            setToast(message);
          }}
        />
      )}
      {toast && (
        <div className="save-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  user,
  data,
  customerMap,
  onNewCustomer,
  onNewOrder,
  onOpenOrder,
}: {
  user: User;
  data: AppData;
  customerMap: Map<string, Customer>;
  onNewCustomer: () => void;
  onNewOrder: () => void;
  onOpenOrder: (id: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Arbeidsoversikt</p>
          <h1>God dag, {user.name.split(" ")[0]}.</h1>
          <p className="subhead">Her bygger du opp kundene og ordrene dine.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary" onClick={onNewCustomer}>
            <Users />
            Ny kunde
          </button>
          <button
            className="primary"
            onClick={onNewOrder}
            disabled={!data.customers.length}
          >
            <Plus />
            Ny ordre
          </button>
        </div>
      </div>
      {!data.orders.length ? (
        <section className="panel empty-state">
          <div className="empty-icon">
            <ClipboardList />
          </div>
          <h2>Ingen ordre ennå</h2>
          <p>
            {data.customers.length
              ? "Opprett din første ordre og begynn å registrere arbeidet."
              : "Start med å opprette en kunde. Deretter kan du lage den første ordren."}
          </p>
          <button
            className="primary"
            onClick={data.customers.length ? onNewOrder : onNewCustomer}
          >
            {data.customers.length ? <Plus /> : <Users />}
            {data.customers.length
              ? "Opprett første ordre"
              : "Opprett første kunde"}
          </button>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Aktive ordre</h2>
              <p>
                {data.orders.length}{" "}
                {data.orders.length === 1 ? "ordre" : "ordrer"}
              </p>
            </div>
          </div>
          <div className="order-list">
            {data.orders.map((order) => (
              <button
                className="order-row"
                key={order.id}
                onClick={() => onOpenOrder(order.id)}
              >
                <div className="order-title">
                  <span>ORDRE #{order.orderNumber}</span>
                  {order.title}
                </div>
                <div className="order-cell">
                  <strong>
                    {customerMap.get(order.customerId)?.name ?? "Ukjent kunde"}
                  </strong>
                  {order.workAddress || "Ingen arbeidsadresse"}
                </div>
                <div>
                  <span className={`status ${orderStatusClass(order.status)}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Customers({
  customers,
  onNew,
  onEdit,
}: {
  customers: Customer[];
  onNew: () => void;
  onEdit: (customer: Customer) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Kunderegister</p>
          <h1>Kunder</h1>
          <p className="subhead">Kundedata lagres trygt i databasen.</p>
        </div>
        <button className="primary" onClick={onNew}>
          <Plus />
          Ny kunde
        </button>
      </div>
      {customers.length ? (
        <section className="panel customer-list">
          {customers.map((customer) => (
            <article key={customer.id}>
              <div className="customer-icon">
                <Building2 />
              </div>
              <div>
                <h3>{customer.name}</h3>
                <p>
                  {customer.type === "PRIVATE" ? "Privatkunde" : customer.organizationNumber ? `Org.nr. ${customer.organizationNumber}` : "Bedriftskunde"}
                </p>
                <span>
                  {customer.email ||
                    customer.phone ||
                    customer.address ||
                    "Ingen kontaktinformasjon"}
                </span>
              </div>
              <button className="secondary" style={{ marginLeft: "auto" }} onClick={() => onEdit(customer)}>Rediger</button>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>Ingen kunder ennå</h2>
          <p>Opprett din første kunde for å komme i gang.</p>
          <button className="primary" onClick={onNew}>
            <Plus />
            Ny kunde
          </button>
        </section>
      )}
    </>
  );
}

function Orders({
  data,
  customerMap,
  onNew,
  onOpen,
}: {
  data: AppData;
  customerMap: Map<string, Customer>;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Arbeidsordre</p>
          <h1>Ordre</h1>
          <p className="subhead">Alle jobbene dine samlet på ett sted.</p>
        </div>
        <button
          className="primary"
          onClick={onNew}
          disabled={!data.customers.length}
        >
          <Plus />
          Ny ordre
        </button>
      </div>
      {data.orders.length ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Alle ordre</h2>
              <p>
                {data.orders.length}{" "}
                {data.orders.length === 1 ? "ordre" : "ordrer"}
              </p>
            </div>
          </div>
          <div className="order-list">
            {data.orders.map((order) => (
              <button
                className="order-row"
                key={order.id}
                onClick={() => onOpen(order.id)}
              >
                <div className="order-title">
                  <span>ORDRE #{order.orderNumber}</span>
                  {order.title}
                </div>
                <div className="order-cell">
                  <strong>
                    {customerMap.get(order.customerId)?.name ?? "Ukjent kunde"}
                  </strong>
                  {order.workAddress || "Ingen arbeidsadresse"}
                </div>
                <div>
                  <span className={`status ${orderStatusClass(order.status)}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel empty-state">
          <div className="empty-icon">
            <ClipboardList />
          </div>
          <h2>Ingen ordre ennå</h2>
          <p>
            {data.customers.length
              ? "Opprett den første ordren for en av kundene dine."
              : "Opprett en kunde først. Deretter kan du lage en ordre."}
          </p>
          <button
            className="primary"
            onClick={onNew}
            disabled={!data.customers.length}
          >
            <Plus />
            Ny ordre
          </button>
        </section>
      )}
    </>
  );
}

function OrderDetails({
  order,
  customer,
  onBack,
  onInvoice,
  onDeleted,
}: {
  order: Order;
  customer?: Customer;
  onBack: () => void;
  onInvoice: (id: string) => void;
  onDeleted: () => Promise<void>;
}) {
  const [timeEntries, setTimeEntries] = useState<
    Array<{
      id: string;
      workDate: string;
      minutes: number;
      ratePerHourOre: number;
      description: string | null;
    }>
  >([]);
  const [deleting, setDeleting] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [deletingRegistration, setDeletingRegistration] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState("");
  const [editingRegistration, setEditingRegistration] = useState<EditableRegistration | null>(null);
  const [extraEntries, setExtraEntries] = useState<ExtraEntry[]>([]);
  const [showTime, setShowTime] = useState(false);
  const [entryKind, setEntryKind] = useState<EntryKind | null>(null);
  async function loadEntries() {
    const [timeResponse, extraResponse] = await Promise.all([
      fetch(`/api/orders/${order.id}/time`, { cache: "no-store" }),
      fetch(`/api/orders/${order.id}/entries`, { cache: "no-store" }),
    ]);
    const [timeData, extraData] = await Promise.all([
      timeResponse.json(),
      extraResponse.json(),
    ]);
    setTimeEntries(timeData.entries ?? []);
    setExtraEntries(extraData.entries ?? []);
  }
  useEffect(() => {
    Promise.all([
      fetch(`/api/orders/${order.id}/time`, { cache: "no-store" }).then((r) =>
        r.json(),
      ),
      fetch(`/api/orders/${order.id}/entries`, { cache: "no-store" }).then(
        (r) => r.json(),
      ),
    ]).then(([timeData, extraData]) => {
      setTimeEntries(timeData.entries ?? []);
      setExtraEntries(extraData.entries ?? []);
    });
  }, [order.id]);
  const totalOre =
    timeEntries.reduce(
      (sum, entry) =>
        sum + Math.round((entry.minutes / 60) * entry.ratePerHourOre),
      0,
    ) + extraEntries.reduce((sum, entry) => sum + entry.amountOre, 0);
  async function deleteRegistration(entry: { id: string; title: string; kind: string; type: "TIME" | "EXTRA" }) {
    if (deletingRegistration) return;
    const detail = entry.kind === "HOTEL" ? " Automatisk opprettet utreise og hjemreise for dette hotellet slettes også. Annen kjøring beholdes." : "";
    if (!window.confirm(`Slette «${entry.title}» helt fra ordren? Eventuelle vedlegg på linjen slettes også, og fakturautkastet oppdateres.${detail} Dette kan ikke angres.`)) return;
    setDeletingRegistration(entry.id);
    setRegistrationError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/registrations`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, type: entry.type }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kunne ikke slette linjen.");
      await loadEntries();
    } catch (error) { setRegistrationError(error instanceof Error ? error.message : "Kunne ikke slette linjen."); }
    finally { setDeletingRegistration(null); }
  }
  async function createInvoice() {
    if (generatingInvoice) return;
    setGeneratingInvoice(true);
    try {
    const response = await fetch(`/api/orders/${order.id}/invoice`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error);
      return;
    }
    onInvoice(data.invoice.id);
    } catch {
      window.alert("Kunne ikke lage fakturautkastet. Prøv igjen.");
    } finally {
      setGeneratingInvoice(false);
    }
  }
  async function deleteOrder() {
    if (
      !window.confirm(
        `Slette ordre #${order.orderNumber}? Eventuelle fakturautkast, registreringer og vedlegg på ordren slettes også. Dette kan ikke angres. Finaliserte fakturaer kan ikke slettes.`,
      )
    )
      return;
    setDeleting(true);
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) {
      window.alert(result.error ?? "Kunne ikke slette ordren.");
      setDeleting(false);
      return;
    }
    await onDeleted();
  }
  return (
    <div className="order-view">
      <section className="order-hero">
        <button className="back-button" onClick={onBack}>
          ← Tilbake til ordrelisten
        </button>
        <div className="order-hero-main">
          <div>
            <p className="eyebrow">Ordre #{order.orderNumber} · Åpen</p>
            <h1>{order.title}</h1>
            <div className="order-meta">
              <span>
                <Building2 />
                {customer?.name ?? "Ukjent kunde"}
              </span>
              <span>{order.workAddress || "Ingen arbeidsadresse"}</span>
            </div>
          </div>
          <div className="order-amount">
            <span>Registrert fakturerbart</span>
            <strong>{formatMoney(totalOre)}</strong>
            <button
              className="primary invoice-button"
              onClick={createInvoice}
              disabled={!totalOre || generatingInvoice}
              aria-busy={generatingInvoice}
            >
              {generatingInvoice ? <LoaderCircle className="loading-spinner" /> : <Sparkles />}
              {generatingInvoice ? "Genererer fakturautkast…" : "Lag fakturautkast"}
            </button>
          </div>
        </div>
      </section>
      <div className="quick-actions">
        <button className="quick-action" onClick={() => setShowTime(true)}>
          <Clock3 />+ TIMER
        </button>
        <button className="quick-action" onClick={() => setEntryKind("LINE")}>
          <Package />+ LINJE
        </button>
        <button
          className="quick-action"
          onClick={() => setEntryKind("DRIVING")}
        >
          <Car />+ KJØRING
        </button>
        <button
          className="quick-action"
          onClick={() => setEntryKind("EXPENSE")}
        >
          <Receipt />+ UTLEGG
        </button>
        <button className="quick-action" onClick={() => setEntryKind("HOTEL")}>
          <Hotel />+ HOTELL
        </button>
        <button className="quick-action" onClick={() => setEntryKind("IMAGE")}>
          <Camera />+ BILDE
        </button>
        <button
          className="quick-action"
          onClick={() => setEntryKind("DOCUMENT")}
        >
          <FileText />+ DOKUMENT
        </button>
      </div>
      <div className="order-danger-actions">
        <button className="danger-button" onClick={deleteOrder} disabled={deleting}>
          <Trash2 />
          {deleting ? "Sletter…" : "Slett ordre"}
        </button>
        <span>Fakturautkast slettes sammen med ordren. Finaliserte fakturaer beskyttes.</span>
      </div>
      {registrationError && <p className="form-error" role="alert">{registrationError}</p>}
      {timeEntries.length || extraEntries.length ? (
        <section className="panel time-list">
          <div className="panel-head">
            <div>
              <h2>Jobbaktivitet</h2>
              <p>Alt som er registrert på ordren</p>
            </div>
          </div>
          {timeEntries.map((entry) => (
            <div className="time-row activity-row" key={entry.id}>
              <div>
                <b>
                  <Clock3 />
                  {formatQuantity(entry.minutes / 60)} timer
                </b>
                <span>
                  {new Date(entry.workDate).toLocaleDateString("nb-NO")} ·{" "}
                  {entry.description || "Arbeid på ordre"}
                </span>
              </div>
              <strong>
                {formatMoney(Math.round(entry.minutes / 60 * entry.ratePerHourOre))}
              </strong>
              <button className="secondary" disabled={["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)} onClick={() => setEditingRegistration({ id: entry.id, type: "TIME", kind: "TIME", workDate: entry.workDate, title: "Timer", description: entry.description, quantity: entry.minutes / 60, rateOre: entry.ratePerHourOre, amountOre: Math.round(entry.minutes / 60 * entry.ratePerHourOre) })}>Rediger</button>
              <button className="danger-button" disabled={Boolean(deletingRegistration) || ["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)} onClick={() => void deleteRegistration({ id: entry.id, title: entry.description || "Timer", kind: "TIME", type: "TIME" })}><Trash2 />{deletingRegistration === entry.id ? "Sletter…" : "Slett"}</button>
            </div>
          ))}
          {extraEntries.map((entry) => (
            <div className="time-row activity-row" key={entry.id}>
              <div>
                <b>{entry.title}</b>
                <span>
                  {new Date(entry.workDate).toLocaleDateString("nb-NO")} ·{" "}
                  {entry.description || entry.fileName || "Registrert"}
                  {entry.kind === "HOTEL" && entry.metadata?.endDate ? ` · Opphold til ${formatDate(String(entry.metadata.endDate))}` : ""}
                  {entry.kind === "DRIVING" && entry.metadata?.tollKnown === false ? " · Bompenger må registreres" : ""}
                </span>
              </div>
              <strong>
                {entry.amountOre
                  ? formatMoney(entry.amountOre)
                  : ["IMAGE", "DOCUMENT"].includes(entry.kind) ? "Dokumentert" : formatMoney(0)}
              </strong>
              <button className="secondary" disabled={["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)} onClick={() => setEditingRegistration({ ...entry, type: "EXTRA", quantity: (entry.quantityThousandths ?? 1000) / 1000, rateOre: entry.unitRateOre ?? 0 })}>Rediger</button>
              <button className="danger-button" disabled={Boolean(deletingRegistration) || ["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)} onClick={() => void deleteRegistration({ ...entry, type: "EXTRA" })}><Trash2 />{deletingRegistration === entry.id ? "Sletter…" : "Slett"}</button>
            </div>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <div className="empty-icon">
            <ClipboardList />
          </div>
          <h2>Ingen registreringer ennå</h2>
          <p>
            Bruk knappene over for timer, varer, kjøring, utlegg, hotell eller
            dokumentasjon.
          </p>
        </section>
      )}
      {editingRegistration && <RegistrationEditModal entry={editingRegistration} orderId={order.id} onClose={() => setEditingRegistration(null)} onSaved={async () => { setEditingRegistration(null); await loadEntries(); }} />}
      {showTime && (
        <TimeModal
          orderId={order.id}
          onClose={() => setShowTime(false)}
          onSaved={async () => {
            setShowTime(false);
            await loadEntries();
          }}
        />
      )}
      {entryKind && (
        <OrderEntryModal
          orderId={order.id}
          kind={entryKind}
          onClose={() => setEntryKind(null)}
          onSaved={async () => {
            setEntryKind(null);
            await loadEntries();
          }}
        />
      )}
    </div>
  );
}

const entryLabels: Record<EntryKind, string> = {
  LINE: "vare eller tjeneste",
  DRIVING: "kjøring",
  EXPENSE: "utlegg",
  HOTEL: "hotell",
  IMAGE: "bilde",
  DOCUMENT: "dokument",
};
function OrderEntryModal({
  orderId,
  kind,
  onClose,
  onSaved,
}: {
  orderId: string;
  kind: EntryKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<ProfileData["products"]>([]);
  const [catalogLoading, setCatalogLoading] = useState(kind === "LINE");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [lineValues, setLineValues] = useState({ title: "", unit: "stk", price: "" });
  useEffect(() => {
    if (kind !== "LINE") return;
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error("Kunne ikke hente standardvarer. Du kan fortsatt legge inn en linje manuelt.");
      setCatalog(result.products ?? []);
    }).catch((error) => setError(error.message)).finally(() => setCatalogLoading(false));
  }, [kind]);
  const [route, setRoute] = useState({
    origin: "",
    destination: "",
    km: "",
    rate: "",
    toll: "0",
    configured: false,
  });
  const [routeBusy, setRouteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const today = localDate();
  const [workDate, setWorkDate] = useState(today);
  const [hotelEnd, setHotelEnd] = useState(today);
  const [autoTravel, setAutoTravel] = useState(true);
  const [routeNote, setRouteNote] = useState("");
  const [tollKnown, setTollKnown] = useState(false);
  const [emissionType, setEmissionType] = useState("GASOLINE");
  const [vehicleName, setVehicleName] = useState("");
  const [autoPass, setAutoPass] = useState(false);
  const [includeReturn, setIncludeReturn] = useState(false);
  const [returnDate, setReturnDate] = useState(today);
  const [returnKm, setReturnKm] = useState("");
  const [returnToll, setReturnToll] = useState("");
  const [departureTime, setDepartureTime] = useState("08:00");
  const [returnTime, setReturnTime] = useState("16:00");
  const [tollProvider, setTollProvider] = useState("GOOGLE");
  const [returnTollKnown, setReturnTollKnown] = useState(false);
  useEffect(() => {
    if (!["DRIVING", "HOTEL"].includes(kind)) return;
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error("Kunne ikke hente standardbilen. Velg biltype manuelt."); return value; }).then((value) => {
      if (cancelled) return;
      setEmissionType(value.settings?.vehicleFuelType || "GASOLINE"); setVehicleName(value.settings?.vehicleName || ""); setAutoPass(Boolean(value.settings?.vehicleAutoPass));
    }).catch((error) => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [kind]);
  const financial = !["IMAGE", "DOCUMENT"].includes(kind);
  useEffect(() => {
    if (kind !== "DRIVING") return;
    let cancelled = false;
    fetch(`/api/orders/${orderId}/route-estimate?date=${workDate}`, { cache: "no-store" })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; })
      .then((value) => { if (cancelled) return;
        setTollProvider(value.tollProvider || "GOOGLE");
        setRouteNote(value.hotelStay ? "Hotellopphold denne dagen: hotell → kunde er foreslått. Bruk «Bytt retning» for returen." : "Firmaadresse → kundeadresse er foreslått.");
        setRoute((current) => ({
          ...current,
          origin: value.origin ?? "",
          destination: value.destination ?? "",
          rate: String(Number(value.mileageRateOre ?? 500) / 100),
          configured: Boolean(value.mapsConfigured),
          km: "", toll: "",
        })); setTollKnown(false);
      }).catch((error) => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [kind, orderId, workDate]);
  async function calculateRoute() {
    setRouteBusy(true);
    setError("");
    try {
    const response = await fetch(`/api/orders/${orderId}/route-estimate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origin: route.origin,
        destination: route.destination,
        emissionType,
        date: workDate, time: departureTime, autoPass,
        ...(includeReturn ? { returnTrip: { date: returnDate, time: returnTime } } : {}),
      }),
    });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Kunne ikke beregne ruten.");
    else {
      setTollKnown(Boolean(value.tollKnown));
      setTollProvider(value.source || "GOOGLE");
      setReturnKm(value.returnRoute ? String(value.returnRoute.distanceKm) : ""); setReturnToll(value.returnRoute?.tollKnown ? String(Number(value.returnRoute.tollOre) / 100) : ""); setReturnTollKnown(Boolean(value.returnRoute?.tollKnown));
      setRouteNote(value.tollKnown && (!includeReturn || value.returnRoute?.tollKnown) ? `Avstand og pris er hentet fra ${value.source === "DIB" ? "DIB (bom og eventuell ferje)" : "Google"}. Kontroller før lagring.` : "Leverandøren oppga ikke alle bompengeprisene. Dette betyr ikke bomfritt: fyll inn manglende beløp manuelt, også 0 dersom ruten faktisk er bomfri.");
      setRoute((current) => ({
        ...current,
        km: String(value.distanceKm),
        toll: value.tollKnown ? String(Number(value.tollOre) / 100) : "",
      }));
    }
    } catch { setError("Kunne ikke beregne ruten. Prøv igjen."); }
    finally { setRouteBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
    const form = new FormData(event.currentTarget);
    form.set("kind", kind);
    form.set("requestId", requestId);
    if (kind === "HOTEL") { form.set("startDate", workDate); form.set("autoTravel", String(autoTravel)); form.set("metadata", JSON.stringify({ emissionType, vehicleName, autoPass })); }
    if (kind === "DRIVING") form.set("metadata", JSON.stringify({ origin: route.origin, destination: route.destination, emissionType, vehicleName, autoPass, departureTime, tollKnown: true, tollSource: tollKnown ? tollProvider === "DIB" ? "DIB" : "GOOGLE_ESTIMATE" : "MANUAL", tollOre: Math.round(Number(route.toll) * 100), ...(includeReturn ? { returnTrip: { date: returnDate, quantity: Number(returnKm), tollOre: Math.round(Number(returnToll) * 100), tollSource: returnTollKnown ? tollProvider === "DIB" ? "DIB" : "GOOGLE_ESTIMATE" : "MANUAL" } } : {}) }));
    let body: BodyInit;
    const headers: HeadersInit = {};
    if (financial) {
      const raw: Record<string, unknown> = Object.fromEntries(form.entries());
      for (const key of ["unitRateOre", "costOre", "tollOre"])
        if (raw[key]) raw[key] = Math.round(Number(raw[key]) * 100);
      if (raw.markupBasisPoints)
        raw.markupBasisPoints = Math.round(Number(raw.markupBasisPoints) * 100);
      body = JSON.stringify(raw);
      headers["content-type"] = "application/json";
      if (kind === "HOTEL") {
        const file = form.get("file");
        if (file instanceof File && file.size) {
          if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
            setError("Bruk JPG, PNG eller PDF for kvitteringen.");
            return;
          }
          const multipart = new FormData();
          for (const [key, value] of Object.entries(raw)) if (key !== "file") multipart.set(key, String(value));
          multipart.set("file", file.type.startsWith("image/") ? await compressImage(file) : file);
          body = multipart;
          delete headers["content-type"];
        }
      }
    } else {
      const file = form.get("file");
      if (kind === "IMAGE" && file instanceof File)
        form.set("file", await compressImage(file));
      body = form;
    }
    const response = await fetch(`/api/orders/${orderId}/entries`, {
      method: "POST",
      headers,
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return;
    }
    onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Kunne ikke lagre registreringen."); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop">
      <section className="entry-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title-icon">
            {kind === "DRIVING" ? (
              <Car />
            ) : kind === "EXPENSE" ? (
              <Receipt />
            ) : kind === "HOTEL" ? (
              <Hotel />
            ) : kind === "IMAGE" ? (
              <Camera />
            ) : kind === "DOCUMENT" ? (
              <FileText />
            ) : (
              <Package />
            )}
          </div>
          <div>
            <h2>Legg til {entryLabels[kind]}</h2>
            <p>Registreringen lagres permanent på ordren.</p>
          </div>
          <button className="icon-button" onClick={onClose} disabled={saving}>
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {kind === "LINE" && <Field label="Velg standard vare eller tjeneste" wide>
              <select value={selectedProduct} disabled={catalogLoading} onChange={(event) => {
                const id = event.target.value;
                setSelectedProduct(id);
                const product = catalog.find((item) => item.id === id);
                setLineValues(product ? { title: product.name, unit: product.unit, price: String(product.defaultPriceOre / 100) } : { title: "", unit: "stk", price: "" });
              }}>
                <option value="">{catalogLoading ? "Henter hurtigvalg…" : "Egendefinert linje / velg hurtigvalg"}</option>
                {catalog.map((product) => <option key={product.id} value={product.id}>{product.name} · {(product.defaultPriceOre / 100).toLocaleString("nb-NO")} kr/{product.unit}</option>)}
              </select>
              {!catalogLoading && !catalog.length && <small>Ingen hurtigvalg ennå. Opprett dem under Produkter og tjenester.</small>}
            </Field>}
            <Field label={kind === "HOTEL" ? "Fra dato (utreise)" : "Dato"}>
              <input
                name="workDate"
                type="date"
                value={workDate}
                onChange={(event) => { setWorkDate(event.target.value); if (hotelEnd < event.target.value) setHotelEnd(event.target.value); if (returnDate < event.target.value) setReturnDate(event.target.value); setReturnKm(""); setReturnToll(""); }}
                required
              />
            </Field>
            <Field
              label={
                kind === "DRIVING"
                  ? "Strekning"
                  : kind === "HOTEL"
                    ? "Hotell"
                    : kind === "IMAGE"
                      ? "Bildetittel"
                      : kind === "DOCUMENT"
                        ? "Dokumenttittel"
                        : "Navn"
              }
            >
              <input
                name="title"
                defaultValue={
                  kind === "LINE" ? undefined : kind === "DRIVING"
                    ? `${route.origin} – ${route.destination}`
                    : ""
                }
                {...(kind === "LINE" ? { value: lineValues.title, onChange: (event: ChangeEvent<HTMLInputElement>) => setLineValues({ ...lineValues, title: event.target.value }) } : {})}
                key={
                  kind === "DRIVING"
                    ? `${route.origin}-${route.destination}`
                    : kind
                }
                required
              />
            </Field>
            {kind === "HOTEL" && <>
              <Field label="Til dato (hjemreise)"><input name="endDate" type="date" min={workDate} value={hotelEnd} onChange={(event) => setHotelEnd(event.target.value)} required /></Field>
              <Field label="Hotelladresse" wide><input name="hotelAddress" maxLength={500} placeholder="Gateadresse, postnummer og sted" required /></Field>
              <Field label="Biltype for hotellreisen"><select value={emissionType} onChange={(event) => setEmissionType(event.target.value)}><option value="GASOLINE">Bensin</option><option value="DIESEL">Diesel</option><option value="ELECTRIC">Elektrisk</option><option value="HYBRID">Hybrid</option></select></Field>
              <label className="wide"><input type="checkbox" checked={autoTravel} onChange={(event) => setAutoTravel(event.target.checked)} /> Legg automatisk til firma → hotell første dag og hotell → firma siste dag.</label>
              <p className="wide">Kjøring beregnes med profilsatsen. Ukjente bompenger må kontrolleres på kjørelinjene. Fjern avhukingen dersom kjøringen allerede er registrert.</p>
            </>}
            {kind === "LINE" && (
              <>
                <Field label="Antall">
                  <input
                    name="quantity"
                    type="number"
                    step="0.001"
                    defaultValue="1"
                    required
                  />
                </Field>
                <Field label="Enhet">
                  <input name="unit" value={lineValues.unit} onChange={(event) => setLineValues({ ...lineValues, unit: event.target.value })} required />
                </Field>
                <Field label="Pris per enhet (kr eks. MVA)">
                  <input
                    name="unitRateOre"
                    type="number"
                    step="0.01"
                    value={lineValues.price}
                    onChange={(event) => setLineValues({ ...lineValues, price: event.target.value })}
                    required
                  />
                </Field>
              </>
            )}
            {kind === "DRIVING" && (
              <>
                <Field label="Fra" wide>
                  <input
                    value={route.origin}
                    onChange={(event) =>
                      { setRoute({ ...route, origin: event.target.value, km: "", toll: "" }); setTollKnown(false); setReturnKm(""); setReturnToll(""); }
                    }
                    required
                  />
                </Field>
                <Field label="Til" wide>
                  <input
                    value={route.destination}
                    onChange={(event) =>
                      { setRoute({ ...route, destination: event.target.value, km: "", toll: "" }); setTollKnown(false); setReturnKm(""); setReturnToll(""); }
                    }
                    required
                  />
                </Field>
                <div className="route-action wide">
                  <button type="button" className="secondary" onClick={() => { setRoute({ ...route, origin: route.destination, destination: route.origin, km: "", toll: "" }); setTollKnown(false); setReturnKm(""); setReturnToll(""); }}>Bytt retning</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={calculateRoute}
                    disabled={routeBusy || !route.configured}
                  >
                    {routeBusy ? "Beregner…" : includeReturn ? "Beregn tur og retur" : "Beregn kjøring"}
                  </button>
                  <span>
                    {route.configured
                      ? tollProvider === "DIB" ? "DIB beregner avstand, bompenger og eventuell ferje." : "Google beregner avstand. DIBs norske bompenge-API er ikke aktivert ennå."
                      : "Ruteberegning er ikke aktivert i denne deployen."}
                  </span>
                </div>
                {routeNote && <p className="wide" role="status">{routeNote}</p>}
                {vehicleName && <p className="wide">Standardbil: {vehicleName}. Biltypen kan overstyres for denne reisen.</p>}
                <Field label="Avreise kl."><input type="time" value={departureTime} onChange={(event) => { setDepartureTime(event.target.value); setRoute({ ...route, toll: "" }); }} required /></Field>
                <label className="wide"><input type="checkbox" checked={autoPass} onChange={(event) => { setAutoPass(event.target.checked); setRoute({ ...route, toll: "" }); setReturnToll(""); }} /> Bruk AutoPASS-pris når DIB er aktivert</label>
                <label className="wide"><input type="checkbox" checked={includeReturn} onChange={(event) => { setIncludeReturn(event.target.checked); setReturnKm(""); setReturnToll(""); }} /> Legg til retur (egen kjørelinje)</label>
                <Field label="Biltype"><select value={emissionType} onChange={(event) => { setEmissionType(event.target.value); setRoute({ ...route, toll: "" }); setTollKnown(false); setReturnToll(""); }}><option value="GASOLINE">Bensin</option><option value="DIESEL">Diesel</option><option value="ELECTRIC">Elbil</option><option value="HYBRID">Ladbar hybrid</option></select></Field>
                <Field label="Kilometer">
                  <input
                    name="quantity"
                    type="number"
                    step="0.1"
                    value={route.km}
                    onChange={(event) =>
                      setRoute({ ...route, km: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Kr per km">
                  <input
                    name="unitRateOre"
                    type="number"
                    step="0.01"
                    value={route.rate}
                    onChange={(event) =>
                      setRoute({ ...route, rate: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Bompenger / ferje (kr)">
                  <input
                    name="tollOre"
                    type="number"
                    min="0"
                    step="0.01"
                    value={route.toll}
                    required
                    onChange={(event) =>
                      { setRoute({ ...route, toll: event.target.value }); setTollKnown(false); }
                    }
                  />
                </Field>
                {includeReturn && <>
                  <Field label="Returdato"><input type="date" min={workDate} value={returnDate} onChange={(event) => { setReturnDate(event.target.value); setReturnToll(""); }} required /></Field>
                  <Field label="Retur kl."><input type="time" value={returnTime} onChange={(event) => { setReturnTime(event.target.value); setReturnToll(""); }} required /></Field>
                  <Field label="Kilometer retur"><input type="number" min="0" step="0.1" value={returnKm} onChange={(event) => setReturnKm(event.target.value)} required /></Field>
                  <Field label="Bompenger / ferje retur (kr)"><input type="number" min="0" step="0.01" value={returnToll} onChange={(event) => { setReturnToll(event.target.value); setReturnTollKnown(false); }} required /></Field>
                  <p className="wide">Returen beregnes separat; avstand og bompenger kan være annerledes enn på utreisen. Samme km-sats brukes begge veier.</p>
                </>}
                <a className="secondary wide" href="https://bompengekalkulator.no/" target="_blank" rel="noopener noreferrer">Åpne bompengekalkulator for manuell kontroll</a>
                <input type="hidden" name="unit" value="km" />
              </>
            )}
            {(kind === "EXPENSE" || kind === "HOTEL") && (
              <>
                <Field label="Kostnad (kr)">
                  <input name="costOre" type="number" step="0.01" required />
                </Field>
                <Field label="Påslag (%)">
                  <input
                    name="markupBasisPoints"
                    type="number"
                    step="0.01"
                    defaultValue="0"
                  />
                </Field>
              </>
            )}
            {!financial && (
              <Field label="Velg fil" wide>
                <input
                  name="file"
                  type="file"
                  accept={
                    kind === "IMAGE"
                      ? "image/jpeg,image/png"
                      : "application/pdf,image/jpeg,image/png"
                  }
                  required
                />
              </Field>
            )}
            {kind === "HOTEL" && (
              <Field label="Last opp kvittering (valgfritt)" wide>
                <input name="file" type="file" accept="image/jpeg,image/png,application/pdf" />
                <small>Velg et kvitteringsbilde eller en PDF, maks 4 MB. Kvitteringen følger fakturavedlegget.</small>
              </Field>
            )}
            <Field label="Beskrivelse" wide>
              <input name="description" />
            </Field>
          </div>
          {!financial && (
            <p className="upload-note">
              JPG, PNG eller PDF, maks 4 MB. Filen følger automatisk med
              fakturavedlegget.
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>
              Avbryt
            </button>
            <button className="primary" disabled={saving || routeBusy}>{saving ? "Lagrer og beregner…" : financial ? "Lagre registrering" : "Last opp og lagre"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RegistrationEditModal({ entry, orderId, onClose, onSaved }: { entry: EditableRegistration; orderId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const priced = ["TIME", "LINE", "DRIVING"].includes(entry.kind);
  const financial = !["IMAGE", "DOCUMENT"].includes(entry.kind);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/registrations`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, type: entry.type, title: raw.title ?? entry.title, workDate: raw.workDate, description: raw.description, quantity: Number(raw.quantity ?? entry.quantity), rateOre: Math.round(Number(raw.rate ?? entry.rateOre / 100) * 100), amountOre: Math.round(Number(raw.amount ?? entry.amountOre / 100) * 100), ...(entry.kind === "DRIVING" ? { tollOre: Math.round(Number(raw.toll) * 100) } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.refreshDraft) {
        const draftResponse = await fetch(`/api/orders/${orderId}/invoice`, { method: "POST" });
        if (!draftResponse.ok) {
          setError("Registreringen er lagret, men fakturautkastet ble ikke oppdatert. Lukk vinduet og velg «Lag fakturautkast» på nytt.");
          return;
        }
      }
      await onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Kunne ikke lagre."); }
    finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop"><section className="entry-modal" role="dialog" aria-modal="true" aria-label="Rediger registrering">
      <div className="modal-head"><div><h2>Rediger registrering</h2><p>Beløp og satser er eks. MVA. Fakturautkast oppdateres ved lagring.</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Lukk"><X /></button></div>
      {(["IMAGE", "DOCUMENT"].includes(entry.kind) || entry.fileName) && (
        <div className="registration-file-preview">
          {(entry.kind === "IMAGE" || entry.mimeType?.startsWith("image/")) && !previewError && <Image src={`/api/orders/${orderId}/entries/${entry.id}/file`} alt={entry.title} width={600} height={350} unoptimized onError={() => setPreviewError(true)} style={{ width: "100%", height: "auto", maxHeight: 350, objectFit: "contain" }} />}
          {previewError && <p className="form-error" role="alert">Bildet kunne ikke forhåndsvises.</p>}
          <a className="secondary" href={`/api/orders/${orderId}/entries/${entry.id}/file`} target="_blank" rel="noopener noreferrer">Åpne opplastet fil</a>
        </div>
      )}
      <form onSubmit={save}><div className="form-grid">
        <Field label="Arbeidsdato"><input name="workDate" type="date" defaultValue={entry.workDate.slice(0, 10)} readOnly={entry.kind === "HOTEL" && Boolean(entry.metadata?.startDate)} required /></Field>
        {entry.kind === "HOTEL" && Boolean(entry.metadata?.startDate) && <p className="wide">Opphold: {formatDate(String(entry.metadata?.startDate))}–{formatDate(String(entry.metadata?.endDate))}. Adresse: {String(entry.metadata?.hotelAddress)}. Reiseperioden beholdes ved beløpsredigering.</p>}
        {entry.type === "EXTRA" && <Field label="Tittel"><input name="title" defaultValue={entry.title} required /></Field>}
        {priced && <><Field label={entry.type === "TIME" ? "Antall timer" : "Antall"}><input name="quantity" type="number" min="0.001" step="0.001" max={entry.type === "TIME" ? 24 : 1000000} defaultValue={entry.quantity} required /></Field><Field label="Sats (kr eks. MVA)"><input name="rate" type="number" min="0" step="0.01" defaultValue={entry.rateOre / 100} required /></Field></>}
        {financial && !priced && <Field label="Totalt beløp (kr eks. MVA)"><input name="amount" type="number" min="0" step="0.01" defaultValue={entry.amountOre / 100} required /></Field>}
        {entry.kind === "DRIVING" && <Field label="Bompenger (kr eks. MVA)"><input name="toll" type="number" min="0" step="0.01" defaultValue={entry.metadata?.tollOre == null ? entry.metadata?.tollKnown === false ? "" : Math.max(0, entry.amountOre - Math.round(entry.quantity * entry.rateOre)) / 100 : Number(entry.metadata.tollOre) / 100} required /><small>Angi 0 kun dersom ruten er bomfri.</small></Field>}
        <Field label="Beskrivelse" wide><textarea name="description" defaultValue={entry.description ?? ""} maxLength={1000} /></Field>
      </div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Avbryt</button><button className="primary" disabled={busy}>{busy ? "Lagrer…" : "Lagre endringer"}</button></div></form>
    </section></div>
  );
}

function TimeModal({
  orderId,
  onClose,
  onSaved,
}: {
  orderId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [rate, setRate] = useState("");
  const [loadingRate, setLoadingRate] = useState(true);
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error("Kunne ikke hente timesatsen. Angi den manuelt.");
      setRate(value.organization?.defaultHourlyRateOre == null ? "" : String(Number(value.organization.defaultHourlyRateOre) / 100));
    }).catch((error) => setError(error.message)).finally(() => setLoadingRate(false));
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    raw.rateOre = String(Math.round(Number(raw.rateOre || 0) * 100));
    const response = await fetch(`/api/orders/${orderId}/time`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return;
    }
    onSaved();
  }
  return (
    <div className="modal-backdrop">
      <section className="entry-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title-icon">
            <Clock3 />
          </div>
          <div>
            <h2>Registrer timer</h2>
            <p>Datoen gjør det enkelt å føre samme ordre over flere dager.</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Arbeidsdato">
              <input
                name="workDate"
                type="date"
                defaultValue={today}
                required
              />
            </Field>
            <Field label="Antall timer">
              <input
                name="hours"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Timesats (kr eks. MVA)">
              <input
                name="rateOre"
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                disabled={loadingRate}
                placeholder={loadingRate ? "Henter fra profilen…" : "Angi timesats"}
                required
              />
            </Field>
            <Field label="Beskrivelse" wide>
              <input name="description" placeholder="Hva ble gjort?" />
            </Field>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Avbryt
            </button>
            <button className="primary" disabled={loadingRate}>Lagre timer</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InvoicesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      invoiceNumber: number | null;
      status: string;
      totalOre: number;
      dueDate: string | null;
      customerName: string;
      orderNumber: number;
      orderTitle: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  useEffect(() => {
    fetch("/api/invoices", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setRows(data.invoices ?? []);
        setLoading(false);
      });
  }, []);
  const label = (invoice: (typeof rows)[number]) =>
    invoice.status === "PAID"
      ? "Betalt"
      : invoice.status === "DRAFT"
        ? "Utkast"
        : invoice.dueDate && new Date(invoice.dueDate) < new Date()
          ? "Forfalt"
          : invoice.status === "PARTIALLY_PAID"
            ? "Delbetalt"
            : "Ikke betalt";
  const visible = rows.filter((invoice) => {
    const status = label(invoice);
    const matchesFilter = filter === "ALL" || status === filter;
    const haystack =
      `${invoice.invoiceNumber ?? ""} ${invoice.customerName} ${invoice.orderNumber} ${invoice.orderTitle}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fakturaarkiv</p>
          <h1>Fakturaer</h1>
          <p className="subhead">
            Gul venter på betaling, rød er forfalt og grønn er betalt.
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="archive-tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søk på fakturanummer, kunde eller ordre"
            aria-label="Søk i fakturaarkivet"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filtrer fakturaer"
          >
            <option value="ALL">Alle statuser</option>
            <option>Utkast</option>
            <option>Ikke betalt</option>
            <option>Forfalt</option>
            <option>Delbetalt</option>
            <option>Betalt</option>
          </select>
        </div>
      )}
      {loading ? (
        <section className="panel empty-state">
          <p>Laster fakturaer…</p>
        </section>
      ) : visible.length ? (
        <section className="panel invoice-list">
          {visible.map((invoice) => (
            <button key={invoice.id} onClick={() => onOpen(invoice.id)}>
              <div>
                <span>
                  {invoice.invoiceNumber
                    ? `FAKTURA #${invoice.invoiceNumber}`
                    : "FAKTURAUTKAST"}
                </span>
                <b>{invoice.customerName}</b>
                <small>
                  Ordre #{invoice.orderNumber} · {invoice.orderTitle}
                </small>
              </div>
              <strong>
                {formatMoney(invoice.totalOre)}
              </strong>
              <em
                className={`payment-${label(invoice).toLowerCase().replace(" ", "-")}`}
              >
                {label(invoice)}
              </em>
              <ChevronRight />
            </button>
          ))}
        </section>
      ) : rows.length ? (
        <section className="panel empty-state">
          <h2>Ingen treff</h2>
          <p>Prøv et annet søk eller statusfilter.</p>
        </section>
      ) : (
        <section className="panel empty-state">
          <div className="empty-icon">
            <FileText />
          </div>
          <h2>Ingen fakturautkast ennå</h2>
          <p>
            Åpne en ordre med registrerte poster og velg «Lag fakturautkast».
          </p>
        </section>
      )}
    </>
  );
}

function InvoiceScreen({
  invoiceId,
  onBack,
  onReset,
}: {
  invoiceId: string;
  onBack: () => void;
  onReset: (orderId: string) => Promise<void>;
}) {
  type Preflight = {
    canFinalize: boolean;
    errors: string[];
    warnings: string[];
  };
  const [data, setData] = useState<{
    invoice: Record<string, unknown>;
    lines: Array<{
      id: string;
      description: string;
      quantityThousandths: number;
      unit: string;
      unitPriceOre: number;
      vatBasisPoints: number;
      subtotalOre: number;
      vatAmountOre: number;
      totalOre: number;
    }>;
  } | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSend, setShowSend] = useState(false);
  async function load() {
    const [invoiceResponse, checkResponse] = await Promise.all([
      fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" }),
      fetch(`/api/invoices/${invoiceId}/preflight`, { cache: "no-store" }),
    ]);
    setData(await invoiceResponse.json());
    setPreflight(await checkResponse.json());
  }
  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" }).then((r) =>
        r.json(),
      ),
      fetch(`/api/invoices/${invoiceId}/preflight`, {
        cache: "no-store",
      }).then((r) => r.json()),
    ]).then(([invoiceData, checkData]) => {
      setData(invoiceData);
      setPreflight(checkData);
    });
  }, [invoiceId]);
  if (!data?.invoice)
    return (
      <section className="panel empty-state">
        <p>Laster fakturautkast…</p>
      </section>
    );
  const invoice = data.invoice;
  const company = (invoice.organizationSnapshot ?? {}) as Record<
    string,
    unknown
  >;
  const customer = (invoice.customerSnapshot ?? {}) as Record<string, unknown>;
  const finalized = invoice.status !== "DRAFT";
  async function resetDraft() {
    if (busy || !window.confirm("Tilbakestille fakturautkastet til ordre? Utkastet fjernes, men alle timer, linjer, bilder og dokumenter beholdes. Du kan lage et nytt utkast senere.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reset`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kunne ikke tilbakestille utkastet.");
      await onReset(result.orderId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kunne ikke tilbakestille utkastet.");
    } finally { setBusy(false); }
  }
  async function finalize() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/invoices/${invoiceId}/finalize`, {
      method: "POST",
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Kunne ikke finalisere fakturaen.");
      setPreflight(value.preflight ?? preflight);
      setBusy(false);
      return;
    }
    await load();
    setConfirmed(false);
    setBusy(false);
  }
  async function registerPayment() {
    const remaining = Number(invoice.remainingAmountOre ?? invoice.totalOre);
    const entered = window.prompt(
      "Innbetalt beløp i kroner",
      String(remaining / 100),
    );
    if (!entered) return;
    const amountOre = Math.round(Number(entered.replace(",", ".")) * 100);
    if (!Number.isFinite(amountOre) || amountOre <= 0) return;
    setBusy(true);
    const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountOre,
        paidAt: new Date().toISOString().slice(0, 10),
      }),
    });
    const value = await response.json();
    if (!response.ok) setError(value.error);
    else await load();
    setBusy(false);
  }
  async function sendInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch(`/api/invoices/${invoiceId}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Kunne ikke sende fakturaen.");
    else {
      setShowSend(false);
      await load();
    }
    setBusy(false);
  }
  return (
    <div className="invoice-view">
      <div className="invoice-top">
        <div>
          <button className="back-button dark" onClick={onBack}>
            ← Tilbake til fakturaer
          </button>
          <p className="eyebrow">
            {finalized ? "Finalisert faktura" : "Fakturautkast"}
          </p>
          <h1>
            {finalized
              ? `Faktura #${String(invoice.invoiceNumber)}`
              : "Kontroller fakturagrunnlaget"}
          </h1>
          <p className="subhead">
            {finalized
              ? "Fakturaen er låst og klar for utsending."
              : "Kontroller opplysningene før fakturanummeret låses."}
          </p>
        </div>
        <div className="invoice-actions">
          {!finalized && <button className="secondary" disabled={busy} onClick={resetDraft}>{busy ? "Arbeider…" : "Tilbakestill til ordre"}</button>}
          <a className="secondary" href={`/api/invoices/${invoiceId}/pdf`}>
            <Download />
            Last ned PDF
          </a>
          {finalized &&
            invoice.status !== "PAID" &&
            invoice.status !== "VOID" && (
              <button
                className="secondary"
                onClick={() => setShowSend(!showSend)}
                disabled={busy}
              >
                <FileText />
                Send faktura
              </button>
            )}
          {finalized &&
            invoice.status !== "PAID" &&
            invoice.status !== "VOID" && (
              <button
                className="primary"
                onClick={registerPayment}
                disabled={busy}
              >
                <CheckCircle2 />
                Registrer betaling
              </button>
            )}
        </div>
      </div>
      <div className="invoice-layout">
        <section className="invoice-paper">
          <div className="invoice-paper-head">
            <div className="invoice-logo">
              {typeof company.logoStorageKey === "string" && /^data:image\/(png|jpeg);base64,/.test(company.logoStorageKey) ? <Image src={company.logoStorageKey} alt={String(company.name ?? "Firmalogo")} width={265} height={85} unoptimized style={{ maxWidth: 265, height: "auto", maxHeight: 85, objectFit: "contain" }} /> : <><span>OK</span><b>{String(company.name ?? "Ditt firma")}</b></>}
            </div>
            <div className="invoice-title">
              <span>{finalized ? "FAKTURA" : "FAKTURAUTKAST"}</span>
              <strong>
                {finalized ? `#${String(invoice.invoiceNumber)}` : "Ikke sendt"}
              </strong>
            </div>
          </div>
          <div className="invoice-parties">
            <div>
              <small>FAKTURERES TIL</small>
              <b>{String(customer.name ?? "Kunde")}</b>
              <span>
                {String(customer.address ?? "")}
                <br />
                {String(customer.postalCode ?? "")}{" "}
                {String(customer.city ?? "")}
              </span>
            </div>
            <div className="invoice-dates">
              <p><span>Fakturanummer</span><b>{finalized ? String(invoice.invoiceNumber) : "Tildeles ved finalisering"}</b></p>
              <p>
                <span>Fakturadato</span>
                <b>
                  {formatDate(String(invoice.issueDate))}
                </b>
              </p>
              <p>
                <span>Forfall</span>
                <b>
                  {formatDate(String(invoice.dueDate))}
                </b>
              </p>
              <p><span>Kontonummer</span><b>{formatBankAccount(invoice.bankAccountSnapshot || company.bankAccount) || "Ikke registrert"}</b></p>
              <p><span>KID</span><b>{String(invoice.kid || (finalized ? "Ikke registrert" : "Tildeles ved finalisering"))}</b></p>
            </div>
          </div>
          <div className="invoice-table">
            <div className="invoice-table-row head">
              <span>Beskrivelse</span>
              <span>Antall</span>
              <span>Pris eks. MVA</span>
              <span>Beløp eks. MVA</span>
            </div>
            {data.lines.map((line) => (
              <div className="invoice-table-row" key={line.id}>
                <span>{line.description}</span>
                <span>
                  {formatQuantity(line.quantityThousandths / 1000)}{" "}
                  {line.unit}
                </span>
                <span>
                  {formatMoney(line.unitPriceOre)}
                </span>
                <span>
                  {formatMoney(line.subtotalOre)}
                </span>
              </div>
            ))}
          </div>
          <div className="invoice-totals">
            <p>
              <span>Netto</span>
              <b>
                {formatMoney(Number(invoice.subtotalOre))}
              </b>
            </p>
            <p>
              <span>MVA</span>
              <b>
                {formatMoney(Number(invoice.vatAmountOre))}
              </b>
            </p>
            <p className="grand-total">
              <span>Å betale</span>
              <b>
                {formatMoney(Number(invoice.totalOre))}
              </b>
            </p>
          </div>
          <div className="invoice-footer">
            <div className="invoice-footer-note"><b>Takk for oppdraget!</b><p>{finalized ? "Vennligst bruk KID ved betaling. Ta kontakt dersom du har spørsmål til fakturaen." : "Dette er et fakturautkast og skal ikke betales før fakturaen er finalisert."}</p><p>{String(company.name ?? "")} · {[company.address, company.postalCode, company.city].filter(Boolean).join(", ")}</p></div>
            <span>
              {String(company.invoiceEmail || company.email || "")}{" "}
              {company.invoicePhone || company.phone
                ? `· ${String(company.invoicePhone || company.phone)}`
                : ""}
            </span>
            <span>
              {company.organizationNumber
                ? `Org.nr. ${String(company.organizationNumber)}${company.vatRegistered ? " MVA" : ""}`
                : ""}
            </span>
          </div>
        </section>
        <aside className="panel invoice-check">
          <div className="panel-head">
            <div>
              <h2>Ferdigstillingskontroll</h2>
              <p>
                {finalized
                  ? "Fakturanummeret er låst"
                  : "Må være i orden før finalisering"}
              </p>
            </div>
          </div>
          <div className="invoice-check-body">
            {finalized ? (
              <>
                <div className="secure-note">
                  <LockKeyhole />
                  <div>
                    <b>
                      Faktura #{String(invoice.invoiceNumber)} er finalisert
                    </b>
                    <span>Registreringene og fakturanummeret er låst.</span>
                  </div>
                </div>
                {showSend && (
                  <form className="send-form" onSubmit={sendInvoice}>
                    <Field label="Mottaker">
                      <input
                        name="recipient"
                        type="email"
                        defaultValue={String(customer.email ?? "")}
                        required
                      />
                    </Field>
                    <Field label="Emne">
                      <input
                        name="subject"
                        defaultValue={`Faktura ${String(invoice.invoiceNumber)} fra ${String(company.name ?? "firma")}`}
                        required
                      />
                    </Field>
                    <Field label="Melding">
                      <textarea
                        name="message"
                        rows={6}
                        defaultValue={`Hei,\n\nDu har mottatt en faktura fra ${String(company.name ?? "firmaet")} på ${(Number(invoice.totalOre) / 100).toLocaleString("nb-NO")} kr. Faktura og dokumentasjonsvedlegg følger vedlagt.\n\nMed vennlig hilsen\n${String(company.name ?? "")}`}
                        required
                      />
                    </Field>
                    {error && <p className="form-error">{error}</p>}
                    <button className="primary full" disabled={busy}>
                      {busy ? "Sender…" : "Send faktura med vedlegg"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className="check-summary">
                  <b>
                    {preflight?.canFinalize
                      ? "Klar for finalisering"
                      : "Noe må kompletteres"}
                  </b>
                  <span>
                    {preflight?.canFinalize
                      ? "Advarsler stopper ikke finalisering."
                      : "Rett feilene og lag utkastet på nytt."}
                  </span>
                </div>
                <div className="check-list">
                  {preflight?.errors.map((item) => (
                    <div className="check warn" key={item}>
                      <AlertTriangle />
                      {item}
                    </div>
                  ))}
                  {preflight?.warnings.map((item) => (
                    <div className="check warn" key={item}>
                      <AlertTriangle />
                      {item}
                    </div>
                  ))}
                  {preflight?.canFinalize && (
                    <div className="check">
                      <CheckCircle2 />
                      Beløp og påkrevde opplysninger er kontrollert.
                    </div>
                  )}
                </div>
                <label className="confirm-row">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    Jeg har kontrollert fakturaen og forstår at fakturanummeret
                    låses.
                  </span>
                </label>
                {error && <p className="form-error">{error}</p>}
                <button
                  className="primary full"
                  onClick={finalize}
                  disabled={!preflight?.canFinalize || !confirmed || busy}
                >
                  {busy ? "Finaliserer…" : "Finaliser og tildel fakturanummer"}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function BankScreen() {
  type BankData = {
    configured: boolean;
    provider: string;
    mode: string;
    connections: Array<{
      id: string;
      status: string;
      account_number_masked: string | null;
      consent_expires_at: string | null;
      last_synced_at: string | null;
    }>;
  };
  const [data, setData] = useState<BankData | null>(null);
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankId, setBankId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => {
    fetch("/api/bank", { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => {
        setData(value);
        if (value.configured) {
          setBanksLoading(true);
          fetch("/api/bank/banks", { cache: "no-store" })
            .then((response) => response.json())
            .then((result) => {
              setBanks(result.banks ?? []);
              if (result.banks?.[0]) setBankId(result.banks[0].id);
              if (result.error) setError(result.error);
            })
            .catch(() => setError("Kunne ikke hente banklisten. Prøv igjen."))
            .finally(() => setBanksLoading(false));
        }
      });
  }, []);
  async function reloadBanks() {
    setBanksLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bank/banks", { cache: "no-store" });
      const value = await response.json();
      setBanks(value.banks ?? []);
      setBankId(value.banks?.[0]?.id ?? "");
      if (!response.ok) setError(value.error ?? "Kunne ikke hente banklisten.");
    } catch {
      setError("Kunne ikke hente banklisten. Prøv igjen.");
    } finally {
      setBanksLoading(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/bank/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bankId }),
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Kunne ikke starte banktilkoblingen.");
      setBusy(false);
      return;
    }
    window.location.assign(value.consentUrl);
  }
  async function sync() {
    setBusy(true);
    setError("");
    setResult("");
    const response = await fetch("/api/bank/sync", { method: "POST" });
    const value = await response.json();
    if (!response.ok)
      setError(value.error ?? "Kunne ikke synkronisere banken.");
    else
      setResult(
        `${value.imported} nye transaksjoner hentet, ${value.matched} matchet mot faktura.`,
      );
    setBusy(false);
  }
  if (!data)
    return (
      <section className="panel empty-state">
        <p>Laster bankstatus…</p>
      </section>
    );
  const active = data.connections.find(
    (connection) => connection.status === "CONNECTED",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Betalingsavstemming</p>
          <h1>Bank og betaling</h1>
          <p className="subhead">
            Koble firmakontoen for automatisk matching av KID og innbetalinger.
          </p>
        </div>
      </div>
      <section className="panel bank-card">
        <div className="bank-hero">
          <div className="empty-icon">
            <Banknote />
          </div>
          <div>
            <h2>{active ? "Bankkonto tilkoblet" : "Koble til firmakonto"}</h2>
            <p>
              {active
                ? `Konto ${active.account_number_masked ?? ""} er klar for avstemming.`
                : "OK Works bruker en sikker PSD2-leverandør. BankID gjennomføres hos banken; vi lagrer aldri BankID-passord eller koder."}
            </p>
          </div>
          <span className={`bank-state ${active ? "connected" : ""}`}>
            {active
              ? "Tilkoblet"
              : data.configured
                ? "Klar for sandbox"
                : "Venter på tilgang"}
          </span>
        </div>
        <div className="bank-details">
          <div>
            <span>Leverandør</span>
            <b>{data.provider}</b>
          </div>
          <div>
            <span>Miljø</span>
            <b>{data.mode === "production" ? "Produksjon" : "Sandbox"}</b>
          </div>
          <div>
            <span>Automatisk KID-match</span>
            <b>{active ? "Aktiv" : "Aktiveres etter tilkobling"}</b>
          </div>
        </div>
        {!data.configured && (
          <div className="bank-notice">
            <AlertTriangle />
            <div>
              <b>Leverandørtilgang mangler</b>
              <span>
                Neonomics klient-ID, klienthemmelighet og krypteringsnøkkel må
                legges inn før BankID-/samtykkeflyten kan startes.
              </span>
            </div>
          </div>
        )}
        {data.configured && !active && (
          <div className="bank-picker">
            <label>
              <span>Velg bank</span>
              <select
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
                disabled={busy || banksLoading || !banks.length}
              >
                <option value="">{banksLoading ? "Henter banker…" : banks.length ? "Velg bank" : "Ingen banker hentet"}</option>
                {banks.map((bank) => (
                  <option value={bank.id} key={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
            {!banksLoading && !banks.length && (
              <button className="secondary" onClick={reloadBanks}>Prøv å hente banker igjen</button>
            )}
            <p>
              Du sendes videre til bankens egen sikre side for samtykke og
              eventuell BankID.
            </p>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        {result && <p className="bank-result">{result}</p>}
        <div className="bank-actions">
          {active ? (
            <button className="primary" onClick={sync} disabled={busy}>
              <Banknote />
              {busy ? "Synkroniserer…" : "Hent nye innbetalinger"}
            </button>
          ) : (
            <button
              className="primary"
              onClick={connect}
              disabled={!data.configured || !bankId || busy}
            >
              <Banknote />
              {busy ? "Starter banktilkobling…" : "Koble til bank med BankID"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function ProductsScreen({ onSaved }: { onSaved: (message: string) => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/profile", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Kunne ikke hente varer og tjenester.");
      return;
    }
    setProfile(result);
  }

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => ({
        ok: response.ok,
        result: await response.json(),
      }))
      .then(({ ok, result }) => {
        if (!ok) {
          setError(result.error ?? "Kunne ikke hente varer og tjenester.");
          return;
        }
        setProfile(result);
      });
  }, []);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    raw.priceOre = String(Math.round(Number(raw.priceOre || 0) * 100));
    raw.vatBasisPoints = String(
      Math.round(Number(raw.vatBasisPoints || 0) * 100),
    );
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Kunne ikke legge til varen eller tjenesten.");
      return;
    }
    form.reset();
    await load();
    onSaved("Varen eller tjenesten er lagt til");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Varekatalog</p>
          <h1>Produkter og tjenester</h1>
          <p className="subhead">
            Lag standardlinjer som kan brukes som hurtigvalg på ordrene.
          </p>
        </div>
      </div>
      <section className="panel settings-card product-settings">
        <div className="panel-head">
          <div>
            <h2>Ny vare eller tjeneste</h2>
            <p>Pris og MVA kan tilpasses når arbeidet registreres.</p>
          </div>
        </div>
        <form className="product-form" onSubmit={addProduct}>
          <input name="name" placeholder="Navn" required />
          <select name="category" aria-label="Kategori">
            <option>Tjeneste</option>
            <option>Vare</option>
            <option>Tillegg</option>
          </select>
          <input name="unit" placeholder="Enhet, f.eks. time" required />
          <input name="priceOre" type="number" min="0" step="0.01" placeholder="Pris kr" required />
          <input name="vatBasisPoints" type="number" min="0" max="100" step="0.01" defaultValue="25" aria-label="MVA prosent" required />
          <button className="primary"><Plus />Legg til</button>
        </form>
        {error && <p className="form-error settings-error">{error}</p>}
        {!profile ? (
          <p className="settings-empty">Laster varekatalog…</p>
        ) : profile.products.length ? (
          <div className="product-list">
            {profile.products.map((product) => (
              <div key={product.id}>
                <div>
                  <b>{product.name}</b>
                  <span>
                    {product.category ?? "Vare/tjeneste"} ·{" "}
                    {(product.defaultPriceOre / 100).toLocaleString("nb-NO")} kr / {product.unit} · {product.vatBasisPoints / 100}% MVA
                  </span>
                </div>
                <ProductActions product={product} onSaved={async (message) => { await load(); onSaved(message); }} />
              </div>
            ))}
          </div>
        ) : (
          <p className="settings-empty">Ingen varer eller tjenester ennå.</p>
        )}
      </section>
    </>
  );
}

function SettingsScreen({
  onSaved,
  onboarding,
}: {
  onSaved: (message: string) => void;
  onboarding?: { complete: boolean; completed: number; total: number };
}) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoError("");
    setLogoBusy(true);
    try {
      const mimeType = file.type || (/\.png$/i.test(file.name) ? "image/png" : /\.jpe?g$/i.test(file.name) ? "image/jpeg" : "");
      if (!["image/png", "image/jpeg"].includes(mimeType)) throw new Error("Velg en PNG- eller JPG-fil. HEIC, SVG og PDF støttes ikke som firmalogo.");
      if (file.size > 15_000_000) throw new Error("Bildet er for stort. Velg et bilde på maks 15 MB.");
      const source = URL.createObjectURL(file);
      const bitmap = new window.Image();
      try {
        await new Promise<void>((resolve, reject) => {
          bitmap.onload = () => resolve();
          bitmap.onerror = () => reject(new Error("Kunne ikke lese bildet. Prøv en PNG- eller JPG-fil."));
          bitmap.src = source;
        });
      } finally {
        URL.revokeObjectURL(source);
      }
      const scale = Math.min(1, 1200 / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(bitmap.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Nettleseren kunne ikke behandle bildet.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.85));
      if (!blob) throw new Error("Kunne ikke behandle bildet.");
      const body = new FormData();
      body.append("logo", blob, file.name);
      const response = await fetch("/api/profile/logo", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kunne ikke lagre logoen.");
      await load();
      onSaved("Firmalogo lagret. Logoen brukes på fakturautkast og nye fakturaer.");
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "Kunne ikke laste opp logoen.");
    } finally {
      setLogoBusy(false);
    }
  }
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/profile", { cache: "no-store" });
    setProfile(await response.json());
  }
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then(setProfile);
  }, []);
  if (!profile?.organization || !profile.settings)
    return (
      <section className="panel empty-state">
        <p>Laster firmaprofil…</p>
      </section>
    );
  const org = profile.organization;
  const settings = profile.settings;
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    raw.vehicleAutoPass = String(new FormData(event.currentTarget).has("vehicleAutoPass"));
    const ore = [
      "defaultHourlyRateOre",
      "mileageRateOre",
      "dietDayRateOre",
      "dietOvernightRateOre",
    ];
    const basis = [
      "defaultVatBasisPoints",
      "hotelMarkupBasisPoints",
      "expenseMarkupBasisPoints",
    ];
    for (const key of ore)
      raw[key] = String(Math.round(Number(raw[key] || 0) * 100));
    for (const key of basis)
      raw[key] = String(Math.round(Number(raw[key] || 0) * 100));
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return;
    }
    onSaved("Firmaprofil og satser er lagret");
    await load();
  }
  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    raw.priceOre = String(Math.round(Number(raw.priceOre || 0) * 100));
    raw.vatBasisPoints = String(
      Math.round(Number(raw.vatBasisPoints || 0) * 100),
    );
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    if (response.ok) {
      event.currentTarget.reset();
      onSaved("Standard vare eller tjeneste er lagt til");
      await load();
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Innstillinger</p>
          <h1>Firmaprofil og standardsatser</h1>
          <p className="subhead">
            Disse opplysningene brukes som standard på ordre og faktura.
          </p>
        </div>
      </div>
      {onboarding && !onboarding.complete && (
        <section className="onboarding-banner">
          <div>
            <p className="eyebrow">Førstegangsoppsett</p>
            <h2>Gjør firmaet klart for første faktura</h2>
            <span>
              Fyll inn organisasjonsnummer, kontaktinformasjon, adresse,
              bankkonto og timesats. Du kan endre alt senere.
            </span>
          </div>
          <strong>
            {onboarding.completed} av {onboarding.total}
          </strong>
        </section>
      )}
      <form className="settings-grid" onSubmit={saveProfile}>
        <section className="panel settings-card">
          <div className="panel-head">
            <div>
              <h2>Firmaopplysninger</h2>
              <p>Opplysninger som kan vises på fakturaen</p>
            </div>
          </div>
          <div className="settings-fields">
            <Field label="Firmanavn" wide>
              <input
                name="name"
                defaultValue={String(org.name ?? "")}
                required
              />
            </Field>
            <Field label="Organisasjonsnummer">
              <input
                name="organizationNumber"
                defaultValue={String(org.organizationNumber ?? "")}
              />
            </Field>
            <Field label="Bankkonto">
              <input
                name="bankAccount"
                defaultValue={String(org.bankAccount ?? "")}
              />
            </Field>
            <Field label="Firmaets e-post">
              <input
                name="email"
                type="email"
                defaultValue={String(org.email ?? "")}
              />
            </Field>
            <Field label="Firmaets telefon">
              <input name="phone" defaultValue={String(org.phone ?? "")} />
            </Field>
            <Field label="Adresse" wide>
              <input name="address" defaultValue={String(org.address ?? "")} />
            </Field>
            <Field label="Postnummer">
              <input
                name="postalCode"
                defaultValue={String(org.postalCode ?? "")}
              />
            </Field>
            <Field label="Sted">
              <input name="city" defaultValue={String(org.city ?? "")} />
            </Field>
            <Field label="E-post på faktura">
              <input
                name="invoiceEmail"
                type="email"
                defaultValue={String(org.invoiceEmail ?? "")}
              />
            </Field>
            <Field label="Telefon på faktura">
              <input
                name="invoicePhone"
                defaultValue={String(org.invoicePhone ?? "")}
              />
            </Field>
          </div>
          <div className="logo-placeholder">
            {org.logoStorageKey ? (
              <Image src={String(org.logoStorageKey)} alt="Firmalogo" width={160} height={60} unoptimized style={{ objectFit: "contain" }} />
            ) : <Building2 />}
            <div>
              <b>Firmalogo</b>
              <span>
                PNG eller JPG. Logoen vises på fakturaen. Finaliserte fakturaer beholder tidligere logo.
              </span>
            </div>
            <div className="logo-upload">
              <label htmlFor="company-logo">{logoBusy ? "Laster opp…" : org.logoStorageKey ? "Bytt logo" : "Last opp logo"}</label>
              <input id="company-logo" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={uploadLogo} disabled={logoBusy} />
              {logoError && <p className="form-error" role="alert">{logoError}</p>}
            </div>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="panel-head">
            <div>
              <h2>Standardsatser</h2>
              <p>Kan overstyres på hver ordre</p>
            </div>
          </div>
          <div className="settings-fields">
            <Field label="Timesats (kr)">
              <input
                name="defaultHourlyRateOre"
                type="number"
                step="0.01"
                defaultValue={Number(org.defaultHourlyRateOre ?? 0) / 100}
              />
            </Field>
            <Field label="Standardbil (navn / registreringsnummer)" wide><input name="vehicleName" maxLength={120} defaultValue={settings.vehicleName ?? ""} placeholder="F.eks. firmabil AB12345" /></Field>
            <Field label="Bilens drivstofftype"><select name="vehicleFuelType" defaultValue={settings.vehicleFuelType || "GASOLINE"}><option value="GASOLINE">Bensin</option><option value="DIESEL">Diesel</option><option value="ELECTRIC">Elbil</option><option value="HYBRID">Ladbar hybrid</option></select></Field>
            <label className="wide"><input type="checkbox" name="vehicleAutoPass" defaultChecked={Boolean(settings.vehicleAutoPass)} /> Bilen har AutoPASS-avtale</label>
            <Field label="Kilometersats (kr)">
              <input
                name="mileageRateOre"
                type="number"
                step="0.01"
                defaultValue={Number(settings.mileageRateOre ?? 0) / 100}
              />
            </Field>
            <Field label="Diett dag (kr)">
              <input
                name="dietDayRateOre"
                type="number"
                step="0.01"
                defaultValue={Number(settings.dietDayRateOre ?? 0) / 100}
              />
            </Field>
            <Field label="Diett overnatting (kr)">
              <input
                name="dietOvernightRateOre"
                type="number"
                step="0.01"
                defaultValue={Number(settings.dietOvernightRateOre ?? 0) / 100}
              />
            </Field>
            <Field label="Hotellpåslag (%)">
              <input
                name="hotelMarkupBasisPoints"
                type="number"
                step="0.01"
                defaultValue={
                  Number(settings.hotelMarkupBasisPoints ?? 0) / 100
                }
              />
            </Field>
            <Field label="Utleggspåslag (%)">
              <input
                name="expenseMarkupBasisPoints"
                type="number"
                step="0.01"
                defaultValue={
                  Number(settings.expenseMarkupBasisPoints ?? 0) / 100
                }
              />
            </Field>
            <Field label="Standard MVA (%)">
              <input
                name="defaultVatBasisPoints"
                type="number"
                step="0.01"
                defaultValue={Number(org.defaultVatBasisPoints ?? 2500) / 100}
              />
            </Field>
            <Field label="Betalingsfrist (dager)">
              <input
                name="defaultPaymentTermsDays"
                type="number"
                defaultValue={Number(org.defaultPaymentTermsDays ?? 14)}
              />
            </Field>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="settings-save">
            <button className="primary">Lagre profil og satser</button>
          </div>
        </section>
      </form>
      <section className="panel settings-card product-settings">
        <div className="panel-head">
          <div>
            <h2>Standard varer og tjenester</h2>
            <p>Brukes som hurtigvalg på ordrene</p>
          </div>
        </div>
        <form className="product-form" onSubmit={addProduct}>
          <input name="name" placeholder="Navn" required />
          <select name="category">
            <option>Tjeneste</option>
            <option>Vare</option>
            <option>Tillegg</option>
          </select>
          <input name="unit" placeholder="Enhet, f.eks. time" required />
          <input
            name="priceOre"
            type="number"
            step="0.01"
            placeholder="Pris kr"
            required
          />
          <input
            name="vatBasisPoints"
            type="number"
            step="0.01"
            defaultValue="25"
            aria-label="MVA prosent"
          />
          <button className="primary">
            <Plus />
            Legg til
          </button>
        </form>
        {profile.products.length ? (
          <div className="product-list">
            {profile.products.map((product) => (
              <div key={product.id}>
                <b>{product.name}</b>
                <span>
                  {(product.defaultPriceOre / 100).toLocaleString("nb-NO")} kr /{" "}
                  {product.unit} · {product.vatBasisPoints / 100}% MVA
                </span>
                <ProductActions product={product} onSaved={async (message) => { await load(); onSaved(message); }} />
              </div>
            ))}
          </div>
        ) : (
          <p className="settings-empty">
            Ingen standardvarer eller tjenester ennå.
          </p>
        )}
      </section>
    </>
  );
}

function ProductActions({ product, onSaved }: { product: ProfileData["products"][number]; onSaved: (message: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await mutate("PATCH", { ...values, id: product.id, priceOre: Math.round(Number(values.priceOre) * 100), vatBasisPoints: Math.round(Number(values.vatBasisPoints) * 100) });
  }
  async function mutate(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(method === "DELETE" ? `/api/products?id=${encodeURIComponent(product.id)}` : "/api/products", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kunne ikke lagre endringen.");
      setEditing(false);
      await onSaved(method === "DELETE" ? "Varen eller tjenesten er slettet" : "Varen eller tjenesten er oppdatert");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Noe gikk galt.");
    } finally { setBusy(false); }
  }
  return (
    <div className="product-actions">
      <button type="button" className="secondary" disabled={busy} onClick={() => { setError(""); setEditing(true); }}>Rediger</button>
      <button type="button" className="danger-button" disabled={busy} onClick={() => { if (window.confirm(`Slette «${product.name}» fra hurtigvalgene? Eksisterende ordre og fakturaer endres ikke.`)) void mutate("DELETE"); }}><Trash2 />Slett</button>
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {editing && (
        <div className="modal-backdrop">
          <section className="entry-modal" role="dialog" aria-modal="true" aria-label="Rediger vare eller tjeneste">
            <div className="modal-head"><h2>Rediger vare eller tjeneste</h2><button type="button" className="icon-button" aria-label="Lukk" disabled={busy} onClick={() => setEditing(false)}><X /></button></div>
            <form onSubmit={save}>
              <div className="form-grid">
                <Field label="Navn" wide><input name="name" defaultValue={product.name} minLength={2} required /></Field>
                <Field label="Kategori"><input name="category" defaultValue={product.category ?? ""} /></Field>
                <Field label="Enhet"><input name="unit" defaultValue={product.unit} required /></Field>
                <Field label="Pris (kr)"><input name="priceOre" type="number" min="0" step="0.01" defaultValue={product.defaultPriceOre / 100} required /></Field>
                <Field label="MVA (%)"><input name="vatBasisPoints" type="number" min="0" max="100" step="0.01" defaultValue={product.vatBasisPoints / 100} required /></Field>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>Avbryt</button><button className="primary" disabled={busy}>{busy ? "Lagrer…" : "Lagre endringer"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function CreateModal({
  kind,
  customers,
  onClose,
  onCreated,
  customer,
}: {
  kind: Exclude<Modal, null>;
  customers: Customer[];
  onClose: () => void;
  onCreated: (message: string) => void;
  customer?: Customer | null;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customerType, setCustomerType] = useState(customer?.type === "PRIVATE" ? "PRIVATE" : "COMPANY");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      const response = await fetch(
        kind === "customer" ? "/api/customers" : "/api/orders",
        {
          method: kind === "customer" && customer ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(kind === "customer" && customer ? { ...values, id: customer.id } : values),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await onCreated(
        kind === "customer"
          ? customer ? "Kunden er oppdatert" : "Kunden er opprettet"
          : `Ordre #${data.order.orderNumber} er opprettet`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Noe gikk galt.");
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="entry-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
          <h2>{kind === "customer" ? customer ? "Rediger kunde" : "Opprett kunde" : "Opprett ordre"}</h2>
            <p>
              {kind === "customer"
                ? "Legg inn det du har nå. Resten kan fylles ut senere."
                : "Velg kunde og gi jobben et tydelig navn."}
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {kind === "customer" ? (
              <>
                <Field label="Kundetype" wide>
                  <select name="type" value={customerType} onChange={(event) => setCustomerType(event.target.value)}>
                    <option value="COMPANY">Bedriftskunde</option>
                    <option value="PRIVATE">Privatkunde</option>
                  </select>
                </Field>
                <Field label="Kundenavn" wide>
                  <input name="name" defaultValue={customer?.name ?? ""} required />
                </Field>
                {customerType === "COMPANY" && <Field label="Organisasjonsnummer">
                  <input name="organizationNumber" defaultValue={customer?.organizationNumber ?? ""} />
                </Field>}
                <Field label="E-post">
                  <input name="email" type="email" defaultValue={customer?.email ?? ""} />
                </Field>
                <Field label="Telefon">
                  <input name="phone" defaultValue={customer?.phone ?? ""} />
                </Field>
                <Field label="Adresse" wide>
                  <input name="address" defaultValue={customer?.address ?? ""} />
                </Field>
                <Field label="Postnummer"><input name="postalCode" defaultValue={customer?.postalCode ?? ""} /></Field>
                <Field label="Sted"><input name="city" defaultValue={customer?.city ?? ""} /></Field>
              </>
            ) : (
              <>
                <Field label="Kunde" wide>
                  <select name="customerId" required defaultValue="">
                    <option value="" disabled>
                      Velg kunde
                    </option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tittel" wide>
                  <input name="title" placeholder="Hva skal gjøres?" required />
                </Field>
                <Field label="Arbeidsadresse" wide>
                  <input name="workAddress" />
                </Field>
                <Field label="Beskrivelse" wide>
                  <textarea name="description" rows={3} />
                </Field>
              </>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Avbryt
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? "Lagrer…"
                : kind === "customer"
                  ? customer ? "Lagre endringer" : "Opprett kunde"
                  : "Opprett ordre"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
