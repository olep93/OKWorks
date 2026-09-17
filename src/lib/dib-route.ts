import "server-only";

const base = "https://dibkunnskapapi.azure-api.net/vCustomer/api";
export const dibFuelType = (fuel: string) => ({ GASOLINE: 1, DIESEL: 2, ELECTRIC: 3, HYBRID: 4 })[fuel as "GASOLINE"] ?? 1;

export function parseDibRoute(value: unknown, autoPass: boolean) {
  const row = (value as { Tur?: Array<{ Meters?: number; Seconds?: number; Kostnad?: number; Rabattert?: number }> })?.Tur?.[0];
  const price = autoPass ? row?.Rabattert : row?.Kostnad;
  if (!row || typeof row.Meters !== "number" || !Number.isFinite(row.Meters) || row.Meters < 0) throw new Error("DIB returnerte ingen gyldig rute.");
  const known = typeof price === "number" && Number.isFinite(price) && price >= 0;
  return { distanceKm: Math.round(row.Meters / 100) / 10, duration: `${row.Seconds ?? 0}s`, tollOre: known ? Math.round(price * 100) : null, tollKnown: known, source: "DIB" as const };
}

async function dibRequest(path: string, key: string, body?: unknown) {
  const response = await fetch(`${base}/${path}`, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(15000),
    headers: { "Ocp-Apim-Subscription-Key": key, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error("DIB kunne ikke beregne ruten. Kontroller API-nøkkel og kvote, eller registrer kjøring manuelt.");
  return response.json();
}

export async function computeDibRoutes(origin: string, destination: string, fuel: string, date: string, time: string, autoPass: boolean, returnTrip?: { date: string; time: string }) {
  const key = process.env.DIB_TOLL_API_KEY;
  if (!key) throw new Error("DIBs bompenge-API er ikke aktivert.");
  const locate = async (address: string) => {
    const rows = await dibRequest(`Address/GetGooglePlaces/${encodeURIComponent(address)}/true`, key);
    const place = Array.isArray(rows) ? rows[0] : null;
    if (!place || !Number.isFinite(Number(place.Latitude)) || !Number.isFinite(Number(place.Longitude)) || place.Latitude == null || place.Longitude == null) throw new Error("DIB fant ikke adressen. Bruk full gateadresse, postnummer og sted.");
    return { Latitude: String(place.Latitude), Longitude: String(place.Longitude) };
  };
  // Share address lookups between directions: a round trip uses four calls, not six.
  const from = await locate(origin);
  const to = await locate(destination);
  const calculate = async (Fra: typeof from, Til: typeof to, day: string, clock: string) => parseDibRoute(await dibRequest("bomstasjoner/GetFeesByWaypoints", key, {
    Fra, Til, Dato_yyyymmdd: day.replaceAll("-", ""), Tidspunkt_hhmm: clock.replace(":", ""), Bilsize: 1, Litenbiltype: dibFuelType(fuel), Storbiltype: 0, Billengdeunder: "5.0", Retur: "0", Tidsreferanser: "1",
  }), autoPass);
  const outbound = await calculate(from, to, date, time);
  const inbound = returnTrip ? await calculate(to, from, returnTrip.date, returnTrip.time) : undefined;
  return { ...outbound, returnRoute: inbound };
}
