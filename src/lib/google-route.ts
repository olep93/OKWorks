import "server-only";
import { parseTollInfo } from "./travel";
export async function computeDrivingRoute(origin: string, destination: string, emissionType = "GASOLINE") {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps er ikke aktivert ennå. Legg inn kjøring manuelt eller aktiver API-nøkkelen.");
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo" },
    body: JSON.stringify({ origin: { address: origin }, destination: { address: destination }, travelMode: "DRIVE", languageCode: "nb-NO", units: "METRIC", extraComputations: ["TOLLS"], routeModifiers: { vehicleInfo: { emissionType } } }),
  });
  const value = await response.json();
  if (!response.ok || !value.routes?.[0]) throw new Error("Google kunne ikke beregne kjøreruten. Kontroller adressene og at Routes API er aktivert.");
  const route = value.routes[0];
  if (!Number.isFinite(route.distanceMeters) || route.distanceMeters < 0) throw new Error("Google returnerte en ugyldig avstand.");
  return { distanceKm: Math.round(route.distanceMeters / 100) / 10, duration: route.duration as string, ...parseTollInfo(route.travelAdvisory?.tollInfo) };
}
