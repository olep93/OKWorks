import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeDibRoutes, dibFuelType, parseDibRoute } from "./dib-route";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("maps the documented fuel types", () => {
  expect(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID"].map(dibFuelType)).toEqual([1, 2, 3, 4]);
});
it("uses full or AutoPASS price, preserving unknown versus explicit zero", () => {
  const data = { Tur: [{ Meters: 12345, Seconds: 600, Kostnad: 100, Rabattert: 80 }] };
  expect(parseDibRoute(data, false).tollOre).toBe(10000);
  expect(parseDibRoute(data, true).tollOre).toBe(8000);
  expect(parseDibRoute({ Tur: [{ Meters: 0, Kostnad: 0 }] }, false).tollKnown).toBe(true);
  expect(parseDibRoute({ Tur: [{ Meters: 1000 }] }, false).tollOre).toBeNull();
  expect(() => parseDibRoute({}, false)).toThrow();
});
it("calculates both directions separately with shared address lookups", async () => {
  vi.stubEnv("DIB_TOLL_API_KEY", "test-key");
  const values = [
    [{ Latitude: "59.9", Longitude: "10.7" }], [{ Latitude: "60.1", Longitude: "11.0" }],
    { Tur: [{ Meters: 10000, Seconds: 600, Kostnad: 100, Rabattert: 80 }] },
    { Tur: [{ Meters: 12000, Seconds: 700, Kostnad: 50, Rabattert: 40 }] },
  ];
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(values.shift())));
  vi.stubGlobal("fetch", fetcher);
  const result = await computeDibRoutes("Firma", "Kunde", "ELECTRIC", "2026-09-17", "08:00", true, { date: "2026-09-18", time: "16:00" });
  expect(result.distanceKm).toBe(10);
  expect(result.returnRoute?.distanceKm).toBe(12);
  expect(result.tollOre).toBe(8000);
  expect(result.returnRoute?.tollOre).toBe(4000);
  expect(fetcher).toHaveBeenCalledTimes(4);
  const outbound = JSON.parse(fetcher.mock.calls[2][1].body);
  const inbound = JSON.parse(fetcher.mock.calls[3][1].body);
  expect(outbound.Litenbiltype).toBe(3);
  expect(outbound.Dato_yyyymmdd).toBe("20260917");
  expect(inbound.Dato_yyyymmdd).toBe("20260918");
  expect(inbound.Tidspunkt_hhmm).toBe("1600");
  expect(inbound.Fra).toEqual(outbound.Til);
});
it("does not report a free route when access or quota fails", async () => {
  vi.stubEnv("DIB_TOLL_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
  await expect(computeDibRoutes("Firma", "Kunde", "DIESEL", "2026-09-17", "08:00", false)).rejects.toThrow("kvote");
});
