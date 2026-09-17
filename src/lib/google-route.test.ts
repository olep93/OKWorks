import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeDrivingRoute } from "./google-route";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("requests vehicle-specific distance and toll estimates", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [{ distanceMeters: 12345, duration: "600s", travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: "NOK", units: "25", nanos: 500000000 }] } } }] })));
  vi.stubGlobal("fetch", fetcher);
  expect(await computeDrivingRoute("Firmaadresse", "Hotelladresse", "ELECTRIC")).toEqual({ distanceKm: 12.3, duration: "600s", tollKnown: true, tollOre: 2550 });
  const request = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(request.routeModifiers.vehicleInfo.emissionType).toBe("ELECTRIC");
  expect(request.extraComputations).toEqual(["TOLLS"]);
});
it("does not convert missing prices into a free route", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [{ distanceMeters: 10000, duration: "60s" }] }))));
  expect((await computeDrivingRoute("Firmaadresse", "Hotelladresse")).tollOre).toBeNull();
});
it("reports unavailable route and configuration instead of fabricating distance", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  await expect(computeDrivingRoute("Firmaadresse", "Hotelladresse")).rejects.toThrow("ikke aktivert");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "denied" }), { status: 403 })));
  await expect(computeDrivingRoute("Firmaadresse", "Hotelladresse")).rejects.toThrow("kunne ikke beregne");
});
