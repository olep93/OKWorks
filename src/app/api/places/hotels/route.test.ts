import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireUser: auth }));
import { POST } from "./route";
const request = (query: string) => new Request("http://localhost/api/places/hotels", { method: "POST", body: JSON.stringify({ query }) });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
describe("hotel search", () => {
  it("requires login", async () => {
    auth.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(request("Runway"))).status).toBe(401);
  });
  it("returns selectable names and full addresses", async () => {
    auth.mockResolvedValue({ id: "user" }); vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ places: [{ id: "hotel1", displayName: { text: "Runway" }, formattedAddress: "Hotellvegen 1, Gardermoen" }] })); vi.stubGlobal("fetch", fetcher);
    expect(await (await POST(request("Runway Gardermoen"))).json()).toEqual({ hotels: [{ id: "hotel1", name: "Runway", address: "Hotellvegen 1, Gardermoen" }] });
    expect(JSON.parse(fetcher.mock.calls[0][1].body).pageSize).toBe(5);
  });
  it("gives a safe message if Places is not enabled", async () => {
    auth.mockResolvedValue({ id: "user" }); vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider error", { status: 403 })));
    const response = await POST(request("Runway"));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("private provider error");
  });
});
